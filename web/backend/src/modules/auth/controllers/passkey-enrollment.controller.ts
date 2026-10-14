// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { passkeyEnrollmentService } from "../services/passkey-enrollment.service.js";
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const passkeyEnrollmentController = {
  issue: asyncHandler(async (req, res) => {
    const { label, language } = z
      .object({
        language: z
          .enum([
            "es",
            "en",
            "pt",
            "fr",
            "de",
            "it",
            "ja",
            "ko",
            "ru",
            "ar",
            "hi",
            "bn",
          ])
          .default("en"),
        label: z.string().trim().min(1).max(128).default("My passkey"),
      })
      .parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    res
      .status(201)
      .json({
        ok: true,
        data: await passkeyEnrollmentService.issue(
          res.locals.user,
          label,
          language,
        ),
      });
  }),
  options: asyncHandler(async (req, res) => {
    const { grant } = z.object({ grant: token }).parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      data: await passkeyEnrollmentService.options(grant, req.get("origin")),
    });
  }),
  verify: asyncHandler(async (req, res) => {
    const { ceremony, response } = z
      .object({ ceremony: token, response: z.record(z.unknown()) })
      .parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    res
      .status(201)
      .json({
        ok: true,
        data: await passkeyEnrollmentService.verify(
          ceremony,
          response,
          req.get("origin"),
        ),
      });
  }),
  result: asyncHandler(async (req, res) => {
    const id = token.parse(req.params["id"]);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      data: await passkeyEnrollmentService.result(id, res.locals.user),
    });
  }),
};
