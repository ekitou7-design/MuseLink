import { Router } from "express";
import { getMuseum, listMuseums } from "../controllers/museumsController";

export const museumRoutes = Router();

museumRoutes.get("/museums", listMuseums);
museumRoutes.get("/museum/:id", getMuseum);
