import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

const app = express();
dotenv.config();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req: Request, res: Response) => {
  res.json({
    Name: "HIP M1 SERVER",
    Status: "Active",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
