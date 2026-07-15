import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "../components/homepage/HomePage";

export const Route = createFileRoute("/")({ component: HomePage });
