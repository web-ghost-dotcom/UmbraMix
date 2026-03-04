# API Reference

## Endpoints

UmbraMix exposes a RESTful API for developers to interact with the privacy mixer, check status, and retrieve information. This API is designed for programmatic access to UmbraMix features.

### Base URL

```
https://api.umbramix.com/v1
```

### Authentication

Currently, the API is public for reading public data. For actions requiring authentication (like creating a mix), we use standard JWT tokens obtained via wallet signature.

### Resources

#### Mixer

- **POST /mix**
  - **Start Mixing**: Initiates a new mix session.
  - **Body**: `{ amount: "100", recipient: "0x..." }`
  - **Response**: `{ id: "mix_123", status: "pending" }`

- **GET /mix/:id**
  - **Get Mix Status**: Retrieves the current status of a mix session.
  - **Params**: `id` - The unique identifier of the mix.
  - **Response**: `{ id: "mix_123", status: "completed", tx_hash: "0x..." }`

#### Statistics

- **GET /stats**
  - **Get Mixer Stats**: Returns global statistics about the mixer usage.
  - **Response**: `{ total_volume: "50000", total_users: "1200", tvl: "15000" }`

### Error Handling

Standard HTTP status codes are used:

- **200 OK**: Request successful.
- **400 Bad Request**: Invalid input parameters.
- **401 Unauthorized**: Authentication required or invalid token.
- **404 Not Found**: Resource not found.
- **500 Internal Server Error**: Something went wrong on our end.

### Webhooks (Coming Soon)

We plan to support webhooks to notify your application of mix events (e.g., `mix.completed`, `mix.failed`).
