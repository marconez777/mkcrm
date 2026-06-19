import urllib.request, zlib, base64
text = '''flowchart TD
classDef entrada fill:#94a3b8,stroke:#475569,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef atencao fill:#6366f1,stroke:#4338ca,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef agenda fill:#0ea5e9,stroke:#0369a1,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef agendaTrat fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef sucesso fill:#14b8a6,stroke:#0f766e,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef antigo fill:#a3a3a3,stroke:#525252,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef alerta fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef geladeira fill:#eab308,stroke:#a16207,stroke-width:2px,color:#fff,rx:8px,ry:8px
classDef lixo fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff,rx:8px,ry:8px
ENTRADA["Leads de Entrada"]:::entrada
QUALIF["Qualificacao"]:::atencao
C_AGEN["Consulta Agendada"]:::agenda
T_AGEN["Tratamento Agendado"]:::agendaTrat
C_FIM["Consulta Finalizada"]:::sucesso
T_FIM["Em Tratamento"]:::sucesso
P_ANTIGO["Paciente Antigo"]:::antigo
SEM_RESP["Sem Resposta"]:::alerta
NUTRI["Nutricao Inativa"]:::geladeira
DESQ["Desqualificado / B2B"]:::lixo
ENTRADA -->|Secretaria responde ou IA qualifica| QUALIF
QUALIF -->|IA identifica data| C_AGEN
QUALIF -->|Marcou procedimento| T_AGEN
C_AGEN -->|Paciente compareceu| C_FIM
T_AGEN -->|Fez a 1a sessao| T_FIM
C_FIM -->|Fechou orcamento| T_AGEN
C_FIM -.->|Nao fechou nada| P_ANTIGO
T_FIM -->|Ciclo concluido| P_ANTIGO
P_ANTIGO -.->|Manda nova msg| P_ANTIGO
QUALIF -- 24h sem responder --> SEM_RESP
C_AGEN -- Faltou / Desmarcou --> SEM_RESP
SEM_RESP -- 7 dias de silencio --> NUTRI
P_ANTIGO -- 60 dias sem contato --> NUTRI
NUTRI -.->|Respondeu| QUALIF
ENTRADA -.->|Vendedor| DESQ'''
compressed = zlib.compress(text.encode('utf-8'), 9)
b64 = base64.urlsafe_b64encode(compressed).decode('utf-8')
url = 'https://kroki.io/mermaid/pdf/' + b64
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response, open(r'C:\Users\win\Desktop\Jornada_do_Paciente.pdf', 'wb') as out_file:
    out_file.write(response.read())
print('Success')
