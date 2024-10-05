import { Router } from "express";
import { fetchModes } from "../controller/userAuthController";

const router = Router();

router.post("/v0.5/users/auth/fetch-modes", fetchModes);

export default router;
