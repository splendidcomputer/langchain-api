import * as dotenv from "dotenv";
dotenv.config();

import readline from "readline";

import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";

// Tavily API Retriever
// import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

// Tool imports
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createRetrieverTool } from "langchain/tools/retriever";

// Custom Data Source, Vector Stores
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

// Local document loaders
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";

// Load web documents
const webLoader = new CheerioWebBaseLoader(
  "https://js.langchain.com/docs/expression_language/"
);
const webDocs = await webLoader.load();

// Load local documents from the docs directory
const localLoader = new DirectoryLoader("docs", {
  ".pdf": (path) => new PDFLoader(path), // Using PDFLoader for PDFs
  ".txt": (path) => new TextLoader(path), // Using TextLoader for .txt files
  ".docx": (path) => new DocxLoader(path), // Using DocxLoader for .docx files
});

// Load local documents
const localDocs = await localLoader.load();

// Combine web and local documents
const allDocs = [...webDocs, ...localDocs];

// Split documents into smaller chunks for better retrieval performance
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 200,
  chunkOverlap: 20,
});
const splitDocs = await splitter.splitDocuments(allDocs);

// Generate embeddings for the split documents
const embeddings = new OpenAIEmbeddings();

// Create a vector store from the documents
const vectorStore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

// Create a retriever that uses the vector store
const retriever = vectorStore.asRetriever({
  k: 2,
});

// Instantiate the model
const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0.2,
});

// Prompt Template
const prompt = ChatPromptTemplate.fromMessages([
  ("system", "You are a helpful assistant."),
  new MessagesPlaceholder("chat_history"),
  ("human", "{input}"),
  new MessagesPlaceholder("agent_scratchpad"),
]);

// Tools
const searchTool = new TavilySearchResults();
const retrieverTool = createRetrieverTool(retriever, {
  name: "general_search",
  description:
    "Use this tool when searching for general information across various topics, including documents from local files and web content.",
});

const tools = [searchTool, retrieverTool];

// Create the agent with the model, prompt, and tools
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  prompt,
  tools,
});

// Create the executor to handle user input and run the agent
const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

// User Input

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const chat_history = [];

// Function to handle user input and agent responses
function askQuestion() {
  rl.question("User: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    const response = await agentExecutor.invoke({
      input: input,
      chat_history: chat_history,
    });

    console.log("Agent: ", response.output);

    chat_history.push(new HumanMessage(input));
    chat_history.push(new AIMessage(response.output));

    askQuestion();
  });
}

// Start the interaction loop
askQuestion();
