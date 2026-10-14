// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team templates — category "web": generic team plus the vertical blueprints (e-commerce, reservas, LMS, comunidad, noticias, help center, microsite).
 * Aggregator: the curated seed DATA lives verbatim under `./web/` (one file per
 * blueprint). This index re-assembles the two public names in the ORIGINAL
 * element order — do not reorder. Zero content changes.
 */
import type { TeamTemplate } from "../../models/team-template.types.js";
import { WEB_GENERIC_TEMPLATES } from "./web/generic.js";
import { WEB_VERTICAL_PART_ECOMMERCE } from "./web/vertical-ecommerce.js";
import { WEB_VERTICAL_PART_RESERVAS } from "./web/vertical-reservas.js";
import { WEB_VERTICAL_PART_LMS } from "./web/vertical-lms.js";
import { WEB_VERTICAL_PART_COMUNIDAD } from "./web/vertical-comunidad.js";
import { WEB_VERTICAL_PART_NOTICIAS } from "./web/vertical-noticias.js";
import { WEB_VERTICAL_PART_HELPCENTER } from "./web/vertical-helpcenter.js";
import { WEB_VERTICAL_PART_MICROSITE } from "./web/vertical-microsite.js";

export { WEB_GENERIC_TEMPLATES };

export const WEB_VERTICAL_TEMPLATES: TeamTemplate[] = [
  ...WEB_VERTICAL_PART_ECOMMERCE, //  11) E-commerce / Marketplace
  ...WEB_VERTICAL_PART_RESERVAS, //   12) Reservas / Bookings
  ...WEB_VERTICAL_PART_LMS, //        13) LMS / Plataforma educativa
  ...WEB_VERTICAL_PART_COMUNIDAD, //  14) Comunidad (Foro / Membresía)
  ...WEB_VERTICAL_PART_NOTICIAS, //   15) Noticias / Wiki
  ...WEB_VERTICAL_PART_HELPCENTER, // 16) Help center (KB + tickets)
  ...WEB_VERTICAL_PART_MICROSITE, //  17) Microsite / One page
];
