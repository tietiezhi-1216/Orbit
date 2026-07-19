pub mod agents;
pub mod assets;
pub mod capsule;
pub mod chat;
pub mod conversations;
pub mod dictation;
pub mod hotkey;
pub mod mcp;
pub mod models;
pub mod permissions;
pub mod projects;
pub mod providers;
pub mod settings;
pub mod skills;
pub mod text_insert;
pub mod titles;
pub mod workspace;

/// Join a user-supplied base URL with an API path, normalizing the common
/// "/v1 or not" ambiguity: both `https://x.com` and `https://x.com/v1` work.
pub(crate) fn api_url(base_url: &str, path: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    let base = base.strip_suffix("/v1").unwrap_or(base);
    format!("{base}/v1/{}", path.trim_start_matches('/'))
}

/// Truncate an (error) response body so UI messages stay readable.
pub(crate) fn snippet(body: &str) -> String {
    const LIMIT: usize = 200;
    let trimmed = body.trim();
    let mut out: String = trimmed.chars().take(LIMIT).collect();
    if trimmed.chars().count() > LIMIT {
        out.push('…');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::api_url;

    #[test]
    fn api_url_appends_v1() {
        assert_eq!(
            api_url("https://relay.example.com", "models"),
            "https://relay.example.com/v1/models"
        );
    }

    #[test]
    fn api_url_keeps_existing_v1() {
        assert_eq!(
            api_url("https://relay.example.com/v1", "models"),
            "https://relay.example.com/v1/models"
        );
        assert_eq!(
            api_url("https://relay.example.com/v1/", "/chat/completions"),
            "https://relay.example.com/v1/chat/completions"
        );
    }

    #[test]
    fn api_url_trims_whitespace_and_slashes() {
        assert_eq!(
            api_url("  https://relay.example.com/  ", "models"),
            "https://relay.example.com/v1/models"
        );
    }
}
