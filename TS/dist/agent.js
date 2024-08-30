import * as dotenv from "dotenv";
dotenv.config();
import readline from "readline";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { createRetrieverTool } from "langchain/tools/retriever";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
const loader = new CheerioWebBaseLoader("https://js.langchain.com/docs/expression_language/");
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 20,
});
const splitDocs = await splitter.splitDocuments(docs);
const embeddings = new OpenAIEmbeddings();
const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
const retriever = vectorStore.asRetriever({
    k: 2,
});
const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0.2,
});
const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
]);
const retrieverTool = createRetrieverTool(retriever, {
    name: "general_search",
    description: "Use this tool when searching for general information across various topics.",
});
const tools = [retrieverTool];
const agent = await createOpenAIFunctionsAgent({
    llm: model,
    prompt,
    tools,
});
const agentExecutor = new AgentExecutor({
    agent,
    tools,
});
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const chatHistory = [];
function askQuestion() {
    rl.question("User: ", async (input) => {
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
//# sourceMappingURL=agent.js.map