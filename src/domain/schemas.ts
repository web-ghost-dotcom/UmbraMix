import { z } from 'zod';

export const sessionCreateSchema = z.object({
    currency: z.enum(['SAT', 'WEI', 'STRK']),
    targetAmounts: z.array(z.string().transform((s) => BigInt(s))).min(1),
    destination: z.string().optional(),
});

export const depositSchema = z.object({
    sessionId: z.string(),
    proofs: z.array(
        z.object({
            secret: z.string(),
            signature: z.string(),
            amount: z.string().transform((s) => BigInt(s)),
            currency: z.enum(['SAT', 'WEI', 'STRK']),
            keysetId: z.string(),
        })
    ),
});

export const withdrawSchema = z.object({
    sessionId: z.string(),
    destination: z.string(),
    amount: z.string().transform((s) => BigInt(s)).optional(),
});

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
