import { backendAddress } from "@/constants/values";

export const BACKEND_IP = backendAddress;
// export const BACKEND_IP = '10.28.203.109';  // Mohith Hotspot
export const BACKEND_PORT = 3000;

export const API_BASE = `http://${BACKEND_IP}:${BACKEND_PORT}`;