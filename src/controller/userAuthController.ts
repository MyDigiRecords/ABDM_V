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
        process.env.FETCH_MODES_URL!,
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
        return res
          .status(502)
          .json({ error: "No response received from external API" });
      } else {
        return res
          .status(500)
          .json({ error: "Unexpected error during external API request" });
      }
    }
    let M1Database;
    try {
      M1Database = await connectToDB();
    } catch (dbError) {
      console.error("Error connecting to database:", dbError);
      return res.status(500).json({ error: "Database connection failed" });
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
      return res.status(500).json({ error: "Database operation failed" });
    }

    // Send the successful response
    res.status(response.status).json(response.data);
  } catch (generalError) {
    console.error("Unexpected error in fetch-modes:", generalError);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
};
