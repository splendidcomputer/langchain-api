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
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createRetrieverTool } from "langchain/tools/retriever";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

// Create Retriever
const loader = new CheerioWebBaseLoader(
  "https://js.langchain.com/docs/expression_language/"
);

const docs = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 200,
  chunkOverlap: 20,
});

const splitDocs = await splitter.splitDocuments(docs);

const embeddings = new OpenAIEmbeddings();

const vectorStore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

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
  ["system", "You are a helpful assistant."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

// Tools
// const searchTool = new TavilySearchResults();
const retrieverTool = createRetrieverTool(retriever, {
  name: "general_search",
  description:
    "Use this tool when searching for general information across various topics.",
});

const tools = [retrieverTool];

const agent = await createOpenAIFunctionsAgent({
  //@ts-ignore
  llm: model,
  prompt,
  tools,
});

// Create the executor
const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

// User Input

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const chatHistory: (HumanMessage | AIMessage)[] = [];

function askQuestion(): void {
  rl.question("User: ", async (input: string) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    const response = await agentExecutor.invoke({
      input,
      chat_history: chatHistory,
    });

    console.log("Agent: ", response.output);

    chatHistory.push(new HumanMessage(input));
    chatHistory.push(new AIMessage(response.output));

    askQuestion();
  });
}

askQuestion();
