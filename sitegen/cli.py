"""Command line interface for the static site generator."""

from __future__ import annotations

import argparse
import functools
import http.server
import sys
from pathlib import Path
from typing import Sequence

from .config import DEFAULT_OUTPUT_DIR, PUBLIC_DIR


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m sitegen",
        description="Build and inspect the Audio-Birdle static site.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    build = subparsers.add_parser("build", help="Render the site into dist/")
    build.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    build.add_argument(
        "--no-clean",
        action="store_true",
        help="Keep existing files in the output directory",
    )

    manifest = subparsers.add_parser(
        "manifest",
        help="Regenerate public/data/manifest.json after a data update",
    )
    manifest.add_argument(
        "--data-dir",
        type=Path,
        default=PUBLIC_DIR / "data",
        help="Directory containing data JSON files",
    )

    serve = subparsers.add_parser("serve", help="Build and serve the site locally")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
    )
    serve.add_argument("--no-build", action="store_true")
    return parser


def _no_cache_handler(directory: str) -> type[http.server.SimpleHTTPRequestHandler]:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self) -> None:  # noqa: D401 - http.server hook
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, format_string: str, *args: object) -> None:
            sys.stderr.write(f"{self.address_string()} - {format_string % args}\n")

    return functools.partial(Handler, directory=directory)  # type: ignore[return-value]


def _run_build(args: argparse.Namespace) -> int:
    from .build import build_site

    summary = build_site(args.output, clean=not args.no_clean)
    print(f"Built {len(summary['pages'])} pages in {summary['output_dir']}")
    print(f"  assets: {summary['asset_build_id']}")
    print(f"  data files: {summary['data_files']}")
    return 0


def _run_manifest(args: argparse.Namespace) -> int:
    from .data_manifest import write_manifest

    path = write_manifest(args.data_dir)
    print(f"Wrote {path}")
    return 0


def _run_serve(args: argparse.Namespace) -> int:
    if not args.no_build:
        from .build import build_site

        summary = build_site(args.output)
        print(f"Built {len(summary['pages'])} pages in {summary['output_dir']}")

    handler = _no_cache_handler(str(args.output))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {args.output} at http://{args.host}:{args.port}/ (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "build":
        return _run_build(args)
    if args.command == "manifest":
        return _run_manifest(args)
    if args.command == "serve":
        return _run_serve(args)

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
