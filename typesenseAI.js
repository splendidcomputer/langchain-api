import { ChatOpenAI } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import * as dotenv from "dotenv";
import readline from "readline";

// Import Typesense client library
import { Client as TypesenseClient } from "typesense";

dotenv.config();

// Instantiate Model
const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Use Cheerio to scrape content from webpage and create documents
const loader = new CheerioWebBaseLoader(
  "https://js.langchain.com/docs/expression_language/"
);
const docs = await loader.load();

// Text Splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 100,
  chunkOverlap: 20,
});
const splitDocs = await splitter.splitDocuments(docs);

// Instantiate Embeddings function
const embeddings = new OpenAIEmbeddings();

// Example Typesense configuration
const typesenseConfig = {
  nodes: [
    {
      host: "localhost", // Replace with your Typesense host
      port: "8108", // Replace with your Typesense port
      protocol: "http", // Replace with 'https' if using HTTPS
    },
  ],
  apiKey: "xyz", // Replace with your Typesense API key
  connectionTimeoutSeconds: 10,
};

// Initialize Typesense client
const typesenseClient = new TypesenseClient(typesenseConfig);

// Create a Typesense schema and collection
const collectionSchema = {
  name: "documents",
  fields: [
    { name: "id", type: "string" },
    { name: "content", type: "text" },
    { name: "created_at", type: "int64" }, // Example timestamp field
  ],
  default_sorting_field: "created_at", // Use an appropriate field for sorting
};

// Attempt to create the collection or update its schema if it exists
try {
  const existingCollection = await typesenseClient
    .collections("documents")
    .retrieve();
  if (existingCollection) {
    await typesenseClient.collections("documents").delete();
  }
} catch (error) {
  // Ignore error if collection doesn't exist yet
}

// Create the collection with defined schema
await typesenseClient.collections().create(collectionSchema);

// Upsert documents into Typesense collection
await typesenseClient.collections("documents").documents().upsert(splitDocs);

// Create a retriever from Typesense
const typesenseRetriever = {
  async search({ query, parameters }) {
    const searchParameters = {
      q: query,
      ...parameters,
    };

    const searchResults = await typesenseClient
      .collections("documents")
      .documents()
      .search(searchParameters);

    return searchResults.hits.map((hit) => ({
      id: hit.document.id,
      content: hit.document.content,
    }));
  },
};

// Create a HistoryAwareRetriever which will generate a search query based on user input and chat history
const retrieverPrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
  [
    "user",
    "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
  ],
]);

// This chain will return a list of documents from the Typesense index
const retrieverChain = await createHistoryAwareRetriever({
  llm: model,
  retriever: typesenseRetriever,
  rephrasePrompt: retrieverPrompt,
});

// Define the prompt for the final chain
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the following context: {context}.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);

// Since we need to pass the docs from the retriever, we will use the createStuffDocumentsChain
const chain = await createStuffDocumentsChain({
  llm: model,
  prompt: prompt,
});

// Create the conversation chain, which will combine the retrieverChain and combineStuffChain to get an answer
const conversationChain = await createRetrievalChain({
  combineDocsChain: chain,
  retriever: retrieverChain,
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to handle user input and AI response
async function handleUserInput() {
  rl.question("You: ", async (userInput) => {
    if (userInput.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    const response = await conversationChain.invoke({
      chat_history: [],
      input: userInput,
    });

    console.log("Assistant:", response.answer);

    // Add user input and AI response to chat history
    const humanMessage = new HumanMessage(userInput);
    const aiMessage = new AIMessage(response.answer);
    conversationChain.updateContext({
      chat_history: [humanMessage, aiMessage],
    });

    // Recursive call to continue interaction
    handleUserInput();
  });
}

// Start interaction
console.log("You can start chatting. Type 'exit' to end the conversation.");
handleUserInput();
