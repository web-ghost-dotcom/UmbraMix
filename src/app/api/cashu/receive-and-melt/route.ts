import { NextResponse } from 'next/server';
import { CashuMint, CashuWallet, getDecodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Tracked outside the main try so the catch block can still build a rescue
    // token when wallet.receive() already consumed the original proofs.
    let rescueProofs: any[] | null = null;
    let rescueMintUrl = '';

    try {
        const { encodedToken, invoice } = await req.json();

        console.log('🔍 [RECEIVE-AND-MELT API] Client should have calculated invoice using fee formula');
        console.log('📋 [RECEIVE-AND-MELT API] Expected: invoice_amount = balance - max(2, 0.01*amount) - 1');

        if (!encodedToken || !invoice) {
            return NextResponse.json({
                error: 'Missing required fields: encodedToken and invoice'
            }, { status: 400 });
        }

        // Step 1: Decode token to get mint URL
        let decoded;
        let mintUrl;

        try {
            decoded = getDecodedToken(encodedToken);
            mintUrl = decoded.mint;
            rescueMintUrl = mintUrl; // save for catch block
            const tokenAmount = decoded.proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

            console.log('💰 [RECEIVE-AND-MELT API] Token details:', {
                mint: mintUrl,
                proofCount: decoded.proofs.length,
                tokenAmount
            });
        } catch (decodeError) {
            console.error('❌ [RECEIVE-AND-MELT API] Failed to decode token:', decodeError);
            return NextResponse.json({
                error: 'Invalid encoded token'
            }, { status: 400 });
        }

        // Step 2: Connect to mint and create wallet
        console.log('🏭 [RECEIVE-AND-MELT API] Connecting to mint:', mintUrl);
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);
        await wallet.loadMint();

        // Step 2.5: PRE-VALIDATE the invoice BEFORE consuming proofs via wallet.receive().
        // If the invoice is too small, expired, or otherwise invalid the mint will throw
        // here and the user's original token proofs are still intact.
        console.log('🔍 [RECEIVE-AND-MELT API] Pre-validating invoice before spending proofs...');
        try {
            const preCheckQuote = await wallet.createMeltQuote(invoice);
            console.log('✅ [RECEIVE-AND-MELT API] Invoice accepted by mint (pre-check):', {
                invoiceAmount: preCheckQuote.amount,
                feeReserve: preCheckQuote.fee_reserve
            });
        } catch (preCheckError: any) {
            const preMsg = preCheckError instanceof Error ? preCheckError.message : String(preCheckError);
            console.error('❌ [RECEIVE-AND-MELT API] Invoice pre-validation failed (token untouched):', preMsg);
            return NextResponse.json({
                error: `Invoice rejected by mint: ${preMsg}`,
                details: {
                    hint: 'The invoice may be too small, expired, or invalid. Your original token is unchanged — try a different invoice.',
                    tokenSafe: true
                }
            }, { status: 400 });
        }

        // Step 3: Receive token — spends original proofs and creates fresh ones.
        // From this point forward the original token is consumed.  Any failure
        // below must return a rescue token so the user can recover their funds.
        console.log('📥 [RECEIVE-AND-MELT API] Receiving token...');
        const receivedProofs = await wallet.receive(encodedToken);
        rescueProofs = receivedProofs; // save so catch block can encode rescue token
        const actualAvailable = receivedProofs.reduce((sum: number, p: any) => sum + p.amount, 0);

        console.log('💰 [RECEIVE-AND-MELT API] Token received:', {
            proofCount: receivedProofs.length,
            totalAmount: actualAvailable
        });

        // Step 4: Extended delay + proof state verification
        console.log('⏳ [RECEIVE-AND-MELT API] Waiting for mint to fully process received proofs...');
        console.log('   Checking proof states before attempting melt (preventing "proofs are pending")');

        // Progressive proof state checking with increasing delays
        let proofsReady = false;
        const maxStateChecks = 6;

        for (let check = 1; check <= maxStateChecks; check++) {
            const delay = Math.min(5000 * check, 20000); // 5s, 10s, 15s, 20s, 20s, 20s
            console.log(`🔍 [RECEIVE-AND-MELT API] Proof state check ${check}/${maxStateChecks} (waiting ${delay}ms first)...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // Check if proofs are ready by checking their state
                const proofStates = await wallet.checkProofsStates(receivedProofs);
                const pendingCount = proofStates.filter(state => state.state !== 'UNSPENT').length;

                console.log(`📊 [RECEIVE-AND-MELT API] Proof states check ${check}:`, {
                    totalProofs: receivedProofs.length,
                    unspentProofs: receivedProofs.length - pendingCount,
                    pendingProofs: pendingCount
                });

                if (pendingCount === 0) {
                    console.log('✅ [RECEIVE-AND-MELT API] All proofs are ready (UNSPENT state)!');
                    proofsReady = true;
                    break;
                } else {
                    console.log(`⏳ [RECEIVE-AND-MELT API] ${pendingCount} proofs still pending...`);
                }
            } catch (stateError) {
                console.log(`⚠️ [RECEIVE-AND-MELT API] Could not check proof states (attempt ${check}):`,
                    stateError instanceof Error ? stateError.message : String(stateError));
            }
        }

        if (!proofsReady) {
            console.log('⚠️ [RECEIVE-AND-MELT API] Proofs may still be pending, but proceeding with melt attempts...');
        }

        // Step 5: Create initial melt quote
        console.log('⚡ [RECEIVE-AND-MELT API] Creating melt quote and executing...');
        const meltQuote = await wallet.createMeltQuote(invoice);

        console.log('📊 [RECEIVE-AND-MELT API] Melt quote details:', {
            invoiceAmount: meltQuote.amount,
            feeReserve: meltQuote.fee_reserve,
            totalRequired: meltQuote.amount + meltQuote.fee_reserve,
            available: actualAvailable
        });

        // Pre-flight: verify token balance covers invoice + fees before starting retry loop
        const totalRequired = meltQuote.amount + meltQuote.fee_reserve;
        if (actualAvailable < totalRequired) {
            console.error('❌ [RECEIVE-AND-MELT API] Insufficient balance:', {
                available: actualAvailable,
                required: totalRequired,
                shortfall: totalRequired - actualAvailable
            });
            return NextResponse.json({
                error: 'INSUFFICIENT_BALANCE',
                details: {
                    available: actualAvailable,
                    invoiceAmount: meltQuote.amount,
                    feeReserve: meltQuote.fee_reserve,
                    totalRequired,
                    shortfall: totalRequired - actualAvailable,
                    hint: 'Token balance does not cover invoice amount + melt fees. Try a smaller invoice or a larger token.'
                }
            }, { status: 400 });
        }

        // Step 6: Execute melt with retry logic and special pending handling
        // IMPORTANT: Pass receivedProofs directly to meltProofs() instead of going
        // through wallet.send() first. wallet.send() charges an additional swap/split
        // fee which can push the total beyond the token balance. meltProofs() handles
        // proof selection internally and returns change for any excess.
        console.log('⚡ [RECEIVE-AND-MELT API] Executing melt with retry capability...');

        const maxRetries = 8;
        let meltResult: any = null;
        let lastError = '';

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [RECEIVE-AND-MELT API] Melt attempt ${attempt}/${maxRetries}...`);

                // Create fresh melt quote for each attempt (in case quote expires)
                const freshMeltQuote = await wallet.createMeltQuote(invoice);

                console.log(`📊 [RECEIVE-AND-MELT API] Melt quote details:`, {
                    invoiceAmount: freshMeltQuote.amount,
                    feeReserve: freshMeltQuote.fee_reserve,
                    totalNeeded: freshMeltQuote.amount + freshMeltQuote.fee_reserve,
                    availableProofs: actualAvailable
                });

                // Add timeout to prevent hanging on slow mints
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Melt operation timed out')), 60000)
                );

                // Pass all receivedProofs directly — meltProofs selects what it needs
                // and returns the rest as change. This avoids the extra swap fee from
                // wallet.send() that was causing "Not enough balance to send".
                console.log('⚡ [RECEIVE-AND-MELT API] Executing melt with received proofs directly...');
                console.log(`💰 [RECEIVE-AND-MELT API] Proofs being sent:`, {
                    proofCount: receivedProofs.length,
                    totalAmount: actualAvailable
                });

                const meltPromise = wallet.meltProofs(freshMeltQuote, receivedProofs);
                const tempMeltResult: any = await Promise.race([meltPromise, timeoutPromise]);

                // FOLLOW GUIDE PATTERN: Verify melt completion with checkMeltQuote
                console.log('🔍 [RECEIVE-AND-MELT API] Verifying melt completion (following guide pattern)...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s like in guide

                const quoteCheck = await wallet.checkMeltQuote(freshMeltQuote.quote);
                console.log('📊 [RECEIVE-AND-MELT API] Melt quote verification:', {
                    state: quoteCheck.state,
                    quoteId: freshMeltQuote.quote.slice(0, 10) + '...',
                    hasPreimage: !!quoteCheck.payment_preimage
                });

                // Verify melt was actually successful according to the mint
                if (quoteCheck.state !== 'PAID') {
                    throw new Error(`Melt executed but quote state is: ${quoteCheck.state}. Expected: PAID`);
                }

                console.log('✅ [RECEIVE-AND-MELT API] Melt confirmed successful by mint!');
                if (quoteCheck.payment_preimage) {
                    console.log('🔐 [RECEIVE-AND-MELT API] Payment preimage received');
                }

                // Change proofs are returned directly by meltProofs (no more separate keep from wallet.send)
                const changeProofs = tempMeltResult.change || [];
                meltResult = {
                    change: changeProofs,
                    changeAmount: changeProofs.reduce((sum: number, p: any) => sum + p.amount, 0),
                    invoiceAmount: freshMeltQuote.amount,
                    feeAmount: freshMeltQuote.fee_reserve,
                    paymentPreimage: quoteCheck.payment_preimage
                };

                console.log(`✅ [RECEIVE-AND-MELT API] Melt succeeded on attempt ${attempt}!`);
                break; // Success! Exit retry loop

            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.log(`⚠️ [RECEIVE-AND-MELT API] Melt attempt ${attempt} failed: ${lastError}`);

                // Check if the error happened during meltProofs() or during quote verification
                const isPendingError = lastError.toLowerCase().includes('pending');
                const isQuoteStateError = lastError.includes('quote state is:');

                if (attempt < maxRetries) {
                    let delay;

                    if (isPendingError) {
                        // "Proofs are pending" means mint is still syncing the received proofs
                        delay = Math.min(10000 * attempt, 45000); // 10s, 20s, 30s, 40s, 45s, 45s, 45s, 45s for pending
                        console.log(`⏳ [RECEIVE-AND-MELT API] 🔄 Proofs pending - very extended mint sync delay: ${delay}ms...`);
                        console.log(`   Coinos mint appears to need extra time - this is attempt ${attempt}/${maxRetries}`);
                        console.log(`   Total wait time so far: ~${(attempt * 10000) / 1000}+ seconds`);
                    } else if (isQuoteStateError) {
                        // Melt was initiated but quote verification failed - check again after delay
                        delay = 3000; // Fixed 3s for quote state checks
                        console.log(`⏳ [RECEIVE-AND-MELT API] 📋 Quote state check failed - waiting ${delay}ms for mint processing...`);
                    } else {
                        // Standard delays for other errors (timeouts, network issues)
                        delay = Math.min(2000 * attempt, 10000); // 2s, 4s, 6s, 8s, 10s for others
                        console.log(`⏳ [RECEIVE-AND-MELT API] Standard retry delay: ${delay}ms...`);
                    }

                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Check if all attempts failed
        if (!meltResult) {
            // Encode the received proofs as a rescue token so the user can retry
            // with a different invoice without losing their funds.
            let rescueToken: string | undefined;
            try {
                rescueToken = getEncodedTokenV4({ mint: rescueMintUrl, proofs: rescueProofs! });
                console.log('🛟 [RECEIVE-AND-MELT API] Encoded rescue token for user recovery');
            } catch (encErr) {
                console.error('⚠️ [RECEIVE-AND-MELT API] Could not encode rescue token:', encErr);
            }

            return NextResponse.json({
                error: `Melt failed after ${maxRetries} attempts. Last error: ${lastError}`,
                ...(rescueToken && {
                    rescueToken,
                    rescueMessage: 'Your funds are safe. Use this new token to retry with a different invoice.'
                })
            }, { status: 500 });
        }

        const changeAmount = meltResult.change?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

        console.log('✅ [RECEIVE-AND-MELT API] Melt completed successfully:', {
            invoiceAmount: meltQuote.amount,
            changeAmount,
            changeProofs: meltResult.change?.length || 0
        });

        return NextResponse.json({
            success: true,
            result: {
                invoiceAmount: meltQuote.amount,
                change: meltResult.change || [],
                changeAmount,
                mintUrl
            }
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        console.error('❌ [RECEIVE-AND-MELT API] Error:', {
            message: msg,
            errorType: error instanceof Error ? error.constructor.name : typeof error
        });

        // If wallet.receive() already consumed the original proofs, try to encode
        // the received proofs as a rescue token so the user can recover their funds.
        let rescueToken: string | undefined;
        if (rescueProofs && rescueProofs.length > 0 && rescueMintUrl) {
            try {
                rescueToken = getEncodedTokenV4({ mint: rescueMintUrl, proofs: rescueProofs });
                console.log('🛟 [RECEIVE-AND-MELT API] Rescue token encoded for error response');
            } catch (encErr) {
                console.error('⚠️ [RECEIVE-AND-MELT API] Could not encode rescue token:', encErr);
            }
        }

        const rescuePayload = rescueToken
            ? { rescueToken, rescueMessage: 'Your ecash was received but the payment failed. Use this token to retry with a different invoice.' }
            : {};

        // Handle specific Cashu errors
        if (msg.includes('Token already spent') || msg.includes('bad response')) {
            return NextResponse.json({
                error: 'Token already spent or invalid',
                ...rescuePayload
            }, { status: 400 });
        }

        if (msg.includes('timed out')) {
            return NextResponse.json({
                error: 'Mint operation timed out',
                ...rescuePayload
            }, { status: 408 });
        }

        return NextResponse.json({
            error: `Receive and melt failed: ${msg}`,
            ...rescuePayload
        }, { status: 500 });
    }
}