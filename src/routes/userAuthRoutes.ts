import { Router } from "express";
import {
  confirmAuth,
  generateLinkToken,
  linkCareContext,
} from "../controller/userAuthController";

const router = Router();

router.post("/generate-link-token", generateLinkToken);
router.post("/confirm-auth", confirmAuth);
router.post("/link-care-context", linkCareContext);

export default router;
