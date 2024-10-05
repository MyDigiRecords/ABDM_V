import axios from "axios";
import NodeRSA from "node-rsa";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";

export const getGatewayAccessToken = async (): Promise<string> => {
  const GATEWAY_URL = "https://dev.abdm.gov.in/gateway/v0.5/sessions";
  const headers = { "Content-Type": "application/json" };

  const bodyParams = JSON.stringify({
    clientId: "SBX_002737",
    clientSecret: "0268b4b2-6a4e-4ea4-8142-6a1d8d14b3c7",
  });

  try {
    const response = await axios.post(GATEWAY_URL, bodyParams, { headers });
    return `Bearer ${response.data.accessToken}`;
  } catch (error) {
    console.error("Error getting access token:", error);
    return "There was an error in getting access token from gateway";
  }
};

// Helper to encrypt data using public key
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
