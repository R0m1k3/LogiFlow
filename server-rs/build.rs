// Liste des motifs d'adresse déclarés dans src/modules/*.rs et src/router.rs
// (`.route("…")`), pour retrouver la route qu'Express aurait servie
// (src/express_routes.rs).

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=src/modules");
    println!("cargo:rerun-if-changed=src/router.rs");
    let mut patterns = BTreeSet::new();
    collect(
        &fs::read_to_string("src/router.rs").expect("src/router.rs"),
        &mut patterns,
    );
    for entry in fs::read_dir("src/modules").expect("src/modules") {
        let path = entry.expect("fichier de module").path();
        if path.extension().is_some_and(|ext| ext == "rs") {
            println!("cargo:rerun-if-changed={}", path.display());
            collect(&fs::read_to_string(&path).expect("module lisible"), &mut patterns);
        }
    }
    let list: Vec<String> = patterns.iter().map(|p| format!("    {p:?},")).collect();
    let out = Path::new(&std::env::var("OUT_DIR").unwrap()).join("route_patterns.rs");
    fs::write(
        out,
        format!(
            "pub const ROUTE_PATTERNS: &[&str] = &[\n{}\n];\n",
            list.join("\n")
        ),
    )
    .unwrap();
}

/// Motifs littéraux passés à `.route(` ; les jokers et les motifs finissant par « / »
/// sont laissés de côté
fn collect(source: &str, patterns: &mut BTreeSet<String>) {
    let mut rest = source;
    while let Some(index) = rest.find(".route(") {
        rest = &rest[index + ".route(".len()..];
        let trimmed = rest.trim_start();
        let Some(literal) = trimmed.strip_prefix('"') else {
            continue;
        };
        let Some(end) = literal.find('"') else {
            continue;
        };
        let pattern = &literal[..end];
        if pattern.starts_with("/api") && !pattern.contains("{*") && !pattern.ends_with('/') {
            patterns.insert(pattern.to_string());
        }
    }
}
