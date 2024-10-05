import { Request, Response } from "express";
import axios from "axios";
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

    const response = await axios.post(
      process.env.FETCH_MODES_URL!,
      requestPayload,
      { headers: newHeaders }
    );

    const M1Database = await connectToDB();
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

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error in fetch-modes:", error);
    res.status(500).json({ error: "An error occurred while fetching modes" });
  }
};
