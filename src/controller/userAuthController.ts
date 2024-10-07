import { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";
import { getGatewayAccessToken } from "../utils/helper";
import { MongoClient } from "mongodb";

const connectToDB = async () => {
  const uri = process.env.ABDM_MONGODB_URL!;
  const client = new MongoClient(uri);
  await client.connect();
  return client.db("abdm_M1").collection("M1_data");
};
export const fetchModes = async (req: Request, res: Response) => {
  try {
    const requestBody = req.body;
    const healthID = requestBody.id;

    if (!healthID || !requestBody.requester) {
      res
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
        "https://dev.abdm.gov.in/gateway/v0.5/users/auth/fetch-modes",
        requestPayload,
        { headers: newHeaders }
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error("Error during API request:", axiosError.message);
      if (axiosError.response) {
        res.status(axiosError.response.status).json({
          error: `Error from external API: ${axiosError.response.data}`,
        });
      } else if (axiosError.request) {
        res.status(502).json({
          error: "No response received from external API",
        });
      } else {
        res.status(500).json({
          error: "Unexpected error during external API request",
        });
      }
      return;
    }
    let M1Database;
    try {
      M1Database = await connectToDB();
    } catch (dbError) {
      console.error("Error connecting to database:", dbError);
      res.status(500).json({ error: "Database connection failed" });
      return;
    }

    try {
      const existingRecord = await M1Database.findOne({ healthID });
      if (existingRecord) {
        await M1Database.updateOne(
          { healthID },
          {
            $set: {
              fetch_req_body: requestPayload,
              fetch_requestId: requestPayload.requestId,
            },
          }
        );
      } else {
        await M1Database.insertOne({
          healthID,
          fetch_req_body: requestPayload,
          fetch_requestId: requestPayload.requestId,
        });
      }
    } catch (dbOperationError) {
      console.error("Error performing database operation:", dbOperationError);
      res.status(500).json({ error: "Database operation failed" });
      return;
    }

    res.status(response.status).json(response.data);
  } catch (generalError) {
    console.error("Unexpected error in fetch-modes:", generalError);
    res.status(500).json({ error: "An unexpected error occurred" });
    return;
  }
};

export const authInit = async (req: Request, res: Response) => {
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

    // Save transactionId and other details in DB
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
    console.error("Error in authInit:", error);
    res.status(500).json({ error: "An error occurred during auth init" });
  }
};
