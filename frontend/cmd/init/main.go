package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
)

// envMapping defines the runtime env vars and their optional non-prefixed aliases.
// The entrypoint reads both forms and writes the VITE_* key to window.__ENV__.
// Priority: VITE_* (explicit) > non-prefixed alias > empty (omitted).
var envMapping = []struct {
	key   string // VITE_* key written to window.__ENV__
	alias string // optional non-prefixed alias (e.g. API_BASE_URL)
}{
	{"VITE_API_BASE_URL", "API_BASE_URL"},
	{"VITE_EMAIL_SERVER_URL", "EMAIL_SERVER_URL"},
	{"VITE_OAUTH_SERVICE_URL", "OAUTH_SERVICE_URL"},
	{"VITE_OAUTH_CLIENT_ID", "OAUTH_CLIENT_ID"},
	{"VITE_OAUTH_REDIRECT_URI", "OAUTH_REDIRECT_URI"},
	{"VITE_OIDC_ISSUER", "OIDC_ISSUER"},
	{"VITE_OIDC_CLIENT_ID", "OIDC_CLIENT_ID"},
	{"VITE_OIDC_REDIRECT_URI", "OIDC_REDIRECT_URI"},
}

func main() {
	config := make(map[string]string)
	for _, m := range envMapping {
		v := os.Getenv(m.key)
		if v == "" && m.alias != "" {
			v = os.Getenv(m.alias)
		}
		if v != "" {
			config[m.key] = v
		}
	}

	jsonData, err := json.Marshal(config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal runtime config: %v\n", err)
		os.Exit(1)
	}

	htmlPath := os.Getenv("RUNTIME_CONFIG_HTML")
	if htmlPath == "" {
		htmlPath = "/usr/share/nginx/html/index.html"
	}

	data, err := os.ReadFile(htmlPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read %s: %v\n", htmlPath, err)
		os.Exit(1)
	}

	script := fmt.Sprintf(`<script>window.__ENV__=%s</script>`, jsonData)
	html := string(data)

	const placeholder = "<!-- RUNTIME_CONFIG -->"
	if i := strings.Index(html, placeholder); i != -1 {
		html = html[:i] + script + html[i+len(placeholder):]
	} else if i := strings.Index(html, "</head>"); i != -1 {
		html = html[:i] + script + html[i:]
	} else if i := strings.Index(html, "</html>"); i != -1 {
		html = html[:i] + script + html[i:]
	}

	if err := os.WriteFile(htmlPath, []byte(html), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write %s: %v\n", htmlPath, err)
		os.Exit(1)
	}

	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: entrypoint <command> [args...]")
		os.Exit(1)
	}

	path, err := exec.LookPath(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot find %s: %v\n", os.Args[1], err)
		os.Exit(1)
	}

	if err := syscall.Exec(path, os.Args[1:], os.Environ()); err != nil {
		fmt.Fprintf(os.Stderr, "exec failed: %v\n", err)
		os.Exit(1)
	}
}
