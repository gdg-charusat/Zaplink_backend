import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((o) => o.trim()),
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/favicon.ico", (req: any, res: any) => res.status(204).end());
app.get("/", (req: any, res: any) => res.status(200).send("ZapLink API Root"));

app.get("/health", (req: any, res: any) => {
  res.status(200).send("OK");
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/favicon.ico" || req.path === "/",
});
app.use(apiLimiter);

app.use("/api", routes);

export default app;
