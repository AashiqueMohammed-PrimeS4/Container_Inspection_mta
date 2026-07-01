const cds = require('@sap/cds');
const { getDestination } = require('@sap-cloud-sdk/connectivity');

const GROQ_MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `
You are PRIVA, a Container Inspection Analyst with tools for SAP inspection data.

TOOLS:
- container ID mentioned → get_container_history
- stats/rates asked → get_inspection_metrics
- both → call both

DATES: today=today | this week=Mon-today | last month=prev month full | none=last 30 days

RULES:
- Fetch before answering; use only fetched data, no outside knowledge.
- Answer only what was asked, nothing extra, no suggestions/opinions/commentary.
- No tool/source mentions. Be concise.
- Plain text only, no markdown (no **, _, #, tables). Use "-" bullets only for lists.
`;

function stripMarkdown(text) {
    if (!text) return text;
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold**
        .replace(/__(.*?)__/g, '$1')       // __bold__
        .replace(/\*(.*?)\*/g, '$1')       // *italic*
        .replace(/_(.*?)_/g, '$1')         // _italic_
        .replace(/^#{1,6}\s+/gm, '')       // # headers
        .replace(/^[-*]\s+/gm, '');        // - or * bullet markers
}

module.exports = cds.service.impl(async function () {

    this.on('analyze', async (req) => {
        const { question } = req.data;
        const log = cds.log('Priva-Agent');

        if (!question) return { message: 'Please ask a question', type: 'error' };

        let mcpClient = null;

        try {
            // ── Dynamic imports (both packages are ESM-first) ─────────────
            const [{ default: Groq }, { Client }, { StreamableHTTPClientTransport }] = await Promise.all([
                import('groq-sdk'),
                import('@modelcontextprotocol/sdk/client/index.js'),
                import('@modelcontextprotocol/sdk/client/streamableHttp.js')
            ]);

            // ── Resolve both destinations from BTP ────────────────────────
            const [groqDest, mcpDest] = await Promise.all([
                getDestination({ destinationName: 'GROQ_API' }),
                getDestination({ destinationName: 'ZINSPECTION_MPC_SERVER' })
            ]);

            // ── Build Groq client — API key lives in URL.headers.Authorization ──
            const groqAuthHeader = groqDest?.headers?.Authorization || '';
            const groqApiKey = groqAuthHeader.replace(/^Bearer\s+/i, '').trim();
            const groq = new Groq({ apiKey: groqApiKey });

            // ── Build MCP client — OAuth2 token from authTokens ───────────
            const mcpToken = mcpDest?.authTokens?.[0]
                ? `Bearer ${mcpDest.authTokens[0].value}`
                : '';
                // console.log("mcpToken",mcpToken);
            const mcpUrl = mcpDest?.url;
             

            mcpClient = new Client({ name: 'Priva-Agent', version: '1.0.0' });
            const transport = new StreamableHTTPClientTransport(
                new URL(`${mcpUrl}/mcp`),
                {
                    requestInit: {
                        headers: {
                            'Authorization': mcpToken,
                            'Content-Type': 'application/json'
                        }
                    }
                }
            );

            await mcpClient.connect(transport);
            log.info('Connected to MCP Server');

            // ── Get available tools directly from MCP server ─────────────
            const { tools: mcpTools } = await mcpClient.listTools();
            log.info('Tools:', mcpTools.map(t => t.name));

            const groqTools = mcpTools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema
                }
            }));

            // ── Step 1: First Groq call — pick the right tool ─────────────
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: question }
            ];

            const firstResponse = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages,
                tools: groqTools,
                tool_choice: 'auto',
                temperature: 0.1
            });
            const tokenUsage = firstResponse.usage?.total_tokens;;
            const firstMsg = firstResponse.choices[0].message;

            // LLM answered without needing a tool
            if (!firstMsg.tool_calls?.length) {
                return { message: stripMarkdown(firstMsg.content), type: 'direct', tokenUsage: tokenUsage };
            }

            messages.push(firstMsg);

            // ── Step 2: Execute tool calls on MCP server ──────────────────
            for (const toolCall of firstMsg.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                log.info(`Calling tool: ${toolName}`, toolArgs);

                const toolResult = await mcpClient.callTool({
                    name: toolName,
                    arguments: toolArgs
                });

                log.info('Tool result received');

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult.content)
                });
            }
            
            // ── Step 3: Final Groq call with tool results ─────────────────
            const finalResponse = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages,
                temperature: 0.4,
                tool_choice: 'none'
            });

            return {
                message: stripMarkdown(finalResponse.choices[0].message.content),
                type: 'analysis',
                tokenUsage: tokenUsage
            };

        } catch (error) {
            log.error('Agent error:', error.message);
            return { message: `Error: ${error.message}`, type: 'error' };

        } finally {
            if (mcpClient) {
                await mcpClient.close();
                cds.log('Priva-Agent').info('MCP connection closed');
            }
        }
    });
});



and cds
@path: 'inspection'
service InspectionService {

    action analyze(question: String) returns {
        message : String;
        type    : String;
        tokenUsage: Integer;
    };
}



@baseUrl = http://localhost:4004

### chat
POST {{baseUrl}}/odata/v4/inspection/analyze
Content-Type: application/json

{
    "question": "summarize the inspection held on this week?"
}


and the response 

HTTP/1.1 200 OK
X-Powered-By: Express
X-Correlation-ID: 7a1175b0-ef00-451f-9ea9-2e638f4c879f
OData-Version: 4.0
Content-Type: application/json; charset=utf-8
Content-Length: 431
Date: Thu, 25 Jun 2026 14:44:16 GMT
Connection: close

{
  "@odata.context": "$metadata#InspectionService.return_InspectionService_analyze",
  "message": "Total inspections: 5  \nAccepted: 4  \nRejected: 1  \nInspectors involved: AASHIQUE (1), AKHILG (4)  \nCarrier types inspected: FlatRack (1), TruckTrailer (1), Container20FT (1), Truck (1), Container40FT (1)  \nCarrier lines: COSCO Shipping Lines (2), Hapag-Lloyd (1), ONE (Ocean Network Express) (2)  ",
  "type": "analysis",
  "tokenUsage": 662
}

so now question is in the local capm app when i try to test its givng the straight forwarfd ans

but when ask from priva chat for the same question so i dont want these much infor i need the above response like in the chat 
summarize the inspection held on this week?

Inspection activity this week (Monday 2026‑06‑24 through today 2026‑06‑25) shows:

Total of 5 inspections recorded.
Acceptance rate: 4 accepted, 1 rejected – 80 % acceptance.
Inspectors: AASHIQUE performed 1 inspection (accepted); AKHILG performed 4 inspections (3 accepted, 1 rejected).
Carrier types inspected: 1 Flat‑Rack, 1 Truck‑Trailer, 1 Container 20 FT, 1 Truck, 1 Container 40 FT – a diverse mix covering both container and truck assets.
Carrier lines involved: COSCO Shipping Lines (2 inspections), Hapag‑Lloyd (1), ONE (Ocean Network Express) (2).
All inspections logged zero inspection hours, indicating they were likely quick spot checks.

Key insight: The week’s inspections were largely successful with a high acceptance rate, but the single rejection on a Hapag‑Lloyd truck‑trailer suggests a potential issue worth a follow‑up review.