import axios from "axios";
import NodeRSA from "node-rsa";
import { Buffer } from "buffer";
import dotenv from "dotenv";

dotenv.config();

export const getGatewayAccessToken = async (): Promise<string> => {
  const GATEWAY_URL = "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions";
  const headers = { "Content-Type": "application/json" };

  const bodyParams = JSON.stringify({
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    grantType: "client_credentials",
  });

  try {
    const response = await axios.post(GATEWAY_URL, bodyParams, { headers });
    return `Bearer ${response.data.accessToken}`;
  } catch (error) {
    console.error("Error getting access token:", error);
    return "There was an error in getting access token from gateway";
  }
};

export const getEncryptedData = async (
  token: string,
  data: string
): Promise<string> => {
  const ACCESS_URL = "https://healthidsbx.abdm.gov.in/api/v2/auth/cert";

  try {
    const headers = { Authorization: token };
    const response = await axios.get(ACCESS_URL, { headers });

    let publicKey = response.data;
    publicKey = publicKey.slice(27, -25);

    const key = new NodeRSA();
    key.importKey(Buffer.from(publicKey, "base64"), "pkcs1-public-pem");

    const encryptedData = key.encrypt(data, "base64");
    return encryptedData;
  } catch (error) {
    console.error("Error encrypting data:", error);
    return "Encryption error";
  }
};
