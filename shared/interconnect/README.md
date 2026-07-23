# Tietiezhi Interconnect Protocol v1

This directory is the cross-client source of truth for Tietiezhi device interconnection. The current Go Hub routes envelopes, while Rust desktop clients can register as nodes, discover peers, and invoke device capabilities.

## Transport

- Device connection: `GET /v1/connect?id={stable-device-id}` upgraded to WebSocket.
- Device discovery: `GET /v1/devices`.
- Remote Core credentials use `Authorization: Bearer {token}` on both HTTP and WebSocket handshakes.
- A deployment may put authentication in the Core itself or in a trusted reverse proxy. Internet-facing endpoints must not be anonymous.

## Registration

The first WebSocket frame must be:

```json
{
  "type": "hello",
  "name": "Tietiezhi MacBook",
  "platform": "macos"
}
```

The Hub responds with `welcome` and broadcasts `presence` whenever the connected device set changes. Device IDs must remain stable across reconnects.

## Capability Invocation

The controller sends a routed `message` envelope:

```json
{
  "type": "message",
  "to": "target-device-id",
  "payload": {
    "type": "capability.invoke",
    "version": 1,
    "requestId": "uuid",
    "capability": "system.status",
    "input": {}
  }
}
```

The device returns a message to the caller assigned by the Hub:

```json
{
  "type": "message",
  "to": "caller-device-id",
  "payload": {
    "type": "capability.result",
    "version": 1,
    "requestId": "uuid",
    "ok": true,
    "output": {},
    "message": "设备能力调用完成"
  }
}
```

`requestId` is the correlation key. Unknown capabilities return `ok: false`; they must not be silently treated as completed.

## Baseline Capabilities

| Capability | Meaning | Remote policy |
| --- | --- | --- |
| `system.ping` | Connectivity probe | Read-only |
| `system.status` | Bounded device/runtime metadata | Read-only |
| `app.focus` | Bring Tietiezhi to the foreground | Requires local approval when remote |
| `notification.send` | Deliver a device notification | Requires local policy |
| `camera.capture` | Capture camera media | Requires foreground approval |
| `location.read` | Read device location | Requires foreground approval |
| `files.access` | Read or mutate files | Scoped grants only |
| `terminal.execute` | Execute a command | Explicit approval and sandbox |
| `browser.control` | Operate a browser session | Explicit approval and audit |

The desktop v1 node automatically serves only `system.ping` and `system.status` to remote callers. Other capabilities are advertised as platform integration targets and return a denial until a device-side approval implementation exists.

## Trust Model

- One primary Core owns identity, durable memory, commitments, and audit history.
- Connected devices contribute capabilities; they do not independently fork the companion identity.
- Agent-driven calls use the same `device_call` approval gate as local tools.
- Direct UI calls count as explicit user action but still respect device-side policy.
- Tokens belong in OS credential storage, never in the persisted Core registry.
- A Hub routes messages and overwrites `from`; clients must not trust caller-supplied identities.
