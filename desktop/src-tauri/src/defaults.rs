//! Built-in relay defaults compiled into the binary so the app works
//! out-of-the-box. On first run these seed a default provider (see
//! `settings::seed_default`); afterwards everything is provider-based and
//! user-editable. Empty constants simply mean "no built-in default".

/// Official relay endpoint used to seed the first provider.
pub const DEFAULT_BASE_URL: &str = "https://api.terln.com";

/// Official relay API key shipped with the client (copied into the keyring for
/// the seeded provider; never returned to the frontend).
pub const DEFAULT_API_KEY: &str = "";
