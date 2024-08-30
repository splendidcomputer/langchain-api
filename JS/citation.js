import * as dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"; // Updated import paths
import { HumanMessage, AIMessage } from "@langchain/core/messages"; // Updated import paths
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
// import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
// import { TavilySearchResults } from "@langchain/tools";
// import { createRetrieverTool } from "langchain/tools";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RunnableMap, RunnablePassthrough } from "@langchain/core/runnables";
// import { Document } from "@langchain/document";

// Load documents from local directory
const localLoader = new DirectoryLoader("docs", {
  ".pdf": (path) => new PDFLoader(path),
  ".txt": (path) => new TextLoader(path),
  ".docx": (path) => new DocxLoader(path),
});

const localDocs = await localLoader.load();

// Split documents into smaller chunks for better retrieval performance
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 200,
  chunkOverlap: 20,
});
const splitDocs = await splitter.splitDocuments(localDocs);

// Generate embeddings for the split documents
const embeddings = new OpenAIEmbeddings();
const vectorStore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

// Create a retriever from the vector store
const retriever = vectorStore.asRetriever({
  k: 2,
});

// Define the schema for the model's output
const llmWithCitedOutput = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0.2,
}).withStructuredOutput(
  z.object({
    answer: z
      .string()
      .describe(
        "The answer to the user question, which is based only on the given sources."
      ),
    citations: z
      .array(z.number())
      .describe(
        "The integer IDs of the SPECIFIC sources which justify the answer."
      ),
  }),
  {
    name: "cited_answers",
  }
);

// Function to format documents with ID for the model to understand
const formatDocsWithId = (docs) => {
  return (
    "\n\n" +
    docs
      .map(
        (doc, idx) =>
          `Source ID: ${idx}\nArticle title: ${
            doc.metadata.title || "No Title"
          }\nArticle Snippet: ${doc.pageContent.slice(0, 200)}...`
      )
      .join("\n\n")
  );
};

// Subchain for generating an answer once we've done retrieval
const prompt = ChatPromptTemplate.fromMessages([
  ("system", "You are a helpful assistant."),
  new MessagesPlaceholder("chat_history"),
  ("human", "{input}"),
  new MessagesPlaceholder("agent_scratchpad"),
]);
const answerChain = prompt.pipe(llmWithCitedOutput);

// Create a runnable map for the retriever and the formatted documents
const map = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
});

// Complete chain that calls the retriever -> formats docs to string -> runs answer subchain -> returns just the answer and retrieved docs.
const chain = map
  .assign({
    context: (input) => formatDocsWithId(input.docs),
  })
  .assign({ cited_answer: answerChain })
  .pick(["cited_answer", "docs"]);

// Function to run the chain and handle user questions
async function askQuestion(question) {
  const result = await chain.invoke(question);
  console.log("Answer: ", result.cited_answer.answer);
  console.log("Citations: ", result.cited_answer.citations);
  console.log("Referenced Documents: ");
  result.cited_answer.citations.forEach((citationId) => {
    console.log(result.docs[citationId].metadata.title || "No Title");
  });
}

// User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function startInteraction() {
  rl.question("User: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    await askQuestion(input);
    startInteraction();
  });
}

// Start the interaction loop
startInteraction();
