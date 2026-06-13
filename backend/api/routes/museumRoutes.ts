import { Router } from "express";
import { getMuseum, listMuseums } from "../controllers/museumsController";

export const museumRoutes = Router();

museumRoutes.get("/museums", listMuseums);
museumRoutes.get("/museum/:id", getMuseum);
museumRoutes.get("/api/museums", listMuseums);
museumRoutes.get("/api/museums/:id", getMuseum);
museumRoutes.get("/api/museum/:id", getMuseum);
