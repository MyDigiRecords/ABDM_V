import { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";
import { getGatewayAccessToken } from "../utils/helper";
import { MongoClient } from "mongodb";

// DB Connection
const connectToDB = async () => {
  const uri = process.env.ABDM_MONGODB_URL!;
  const client = new MongoClient(uri);
  await client.connect();
  return client.db("abdm_M1").collection("M1_data");
};

// 1. Link Token Generation
export const generateLinkToken = async (req: Request, res: Response) => {
  try {
    const requestBody = req.body;
    const healthID = requestBody.id || requestBody.abhaAddress;

    if (!healthID || !requestBody.requester) {
      return res
        .status(400)
        .json({ error: "Invalid request. Health ID or requester is missing." });
    }

    const newHeaders = {
      "Content-Type": "application/json",
      "X-CM-ID": "sbx",
      Authorization: await getGatewayAccessToken(),
    };

    const requestPayload = {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      query: {
        id: healthID,
        purpose: "KYC_AND_LINK",
        requester: requestBody.requester,
      },
    };

    let response;
    try {
      response = await axios.post(
        process.env.LINK_TOKEN_GENERATE_URL!,
        requestPayload,
        { headers: newHeaders }
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error("Error during API request:", axiosError.message);
      if (axiosError.response) {
        return res.status(axiosError.response.status).json({
          error: `Error from external API: ${axiosError.response.data}`,
        });
      } else if (axiosError.request) {
        return res.status(502).json({
          error: "No response received from external API",
        });
      } else {
        return res.status(500).json({
          error: "Unexpected error during external API request",
        });
      }
    }

    // Save the request in DB
    const M1Database = await connectToDB();
    await M1Database.updateOne(
      { healthID },
      {
        $set: {
          link_token_req_body: requestPayload,
          link_token_requestId: requestPayload.requestId,
        },
      },
      { upsert: true }
    );

    res.status(response.status).json(response.data);
  } catch (generalError) {
    console.error("Unexpected error in generateLinkToken:", generalError);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
};

// 2. Confirm Authentication
export const confirmAuth = async (req: Request, res: Response) => {
  try {
    const requestBody = req.body;
    const healthID = requestBody.query.id;

    if (!healthID || !requestBody.query.requester) {
      return res
        .status(400)
        .json({ error: "Invalid request. Health ID or requester is missing." });
    }

    const newHeaders = {
      "Content-Type": "application/json",
      "X-CM-ID": "sbx",
      Authorization: await getGatewayAccessToken(),
    };

    const requestPayload = {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      query: {
        id: healthID,
        purpose: "KYC_AND_LINK",
        authMode: requestBody.query.authMode || "DEMOGRAPHICS",
        requester: requestBody.query.requester,
      },
    };

    // Make the external API call
    const response = await axios.post(
      process.env.AUTH_INIT_URL!,
      requestPayload,
      { headers: newHeaders }
    );

    // Save transactionId in DB
    const M1Database = await connectToDB();
    await M1Database.updateOne(
      { healthID },
      {
        $set: {
          auth_init_req_body: requestPayload,
          auth_init_requestId: requestPayload.requestId,
          transactionId: response.data.transactionId,
        },
      },
      { upsert: true }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error in confirmAuth:", error);
    res
      .status(500)
      .json({ error: "An error occurred during auth confirmation" });
  }
};

// 3. Link Care Context
export const linkCareContext = async (req: Request, res: Response) => {
  try {
    const requestBody = req.body;
    const transactionId = requestBody.transactionId;

    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is missing." });
    }

    const newHeaders = {
      "Content-Type": "application/json",
      "X-CM-ID": "sbx",
      Authorization: await getGatewayAccessToken(),
    };

    const requestPayload = {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      link: {
        careContext: [
          {
            careContextId: requestBody.careContextId,
            display: requestBody.display,
          },
        ],
      },
    };

    const response = await axios.post(
      process.env.LINK_CARE_CONTEXT_URL!,
      requestPayload,
      { headers: newHeaders }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error in linkCareContext:", error);
    res
      .status(500)
      .json({ error: "An error occurred while linking care context" });
  }
};
