import { Router } from "express";
import { fetchModes } from "../controller/userAuthController";

const router = Router();

router.post("/fetch-modes", fetchModes);

export default router;
