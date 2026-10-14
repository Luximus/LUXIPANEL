// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Self-hosted Quill bundle. Built by scripts/build-extracted.mjs into
 * public/scripts/extracted/vendor/quill.js (+ a sibling quill.css emitted from
 * the imported stylesheet). Page scripts import the default export by URL so the
 * heavy editor is loaded only on pages that need it.
 */
import Quill from "quill";
import "quill/dist/quill.snow.css";

export default Quill;
