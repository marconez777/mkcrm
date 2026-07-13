import json
import os

def infer_purpose(filepath):
    filename = os.path.basename(filepath)
    name = os.path.splitext(filename)[0]
    
    purposes = {
        "AdminShell": "Layout principal para a área de administração.",
        "AgentMemories": "Gerenciamento e visualização das memórias dos agentes de IA.",
        "Agents": "Configuração, criação e gestão de agentes de IA.",
        "AiInsights": "Visualização de insights e métricas geradas por IA.",
        "Apn": "Página de visualização ou geração de propostas/apresentações.",
        "Auth": "Autenticação de usuários (login/registro).",
        "Automations": "Configuração de regras e gatilhos de automação (workflows).",
        "Billing": "Gerenciamento de assinaturas e faturamento (Stripe).",
        "Broadcasts": "Gerenciamento e envio de mensagens em massa (transmissões).",
        "Checkout": "Página de checkout para pagamento.",
        "CheckoutReturn": "Página de retorno pós-checkout.",
        "Inbox": "Caixa de entrada centralizada para conversas e atendimento de leads.",
        "Index": "Página inicial de roteamento ou landing page padrão.",
        "Invite": "Aceitação de convites para participar de uma equipe ou workspace.",
        "Kanban": "Visualização de oportunidades/leads em formato de funil (Kanban).",
        "LeadDrawer": "Visualização de detalhes rápidos de um lead em uma gaveta lateral.",
        "Metrics": "Dashboard geral de métricas e resultados.",
        "MetricsAiUsage": "Painel de métricas sobre o consumo e uso de Inteligência Artificial.",
        "MetricsEngagement": "Métricas de engajamento de usuários e leads.",
        "MetricsOps": "Métricas operacionais e de equipe.",
        "NotFound": "Página de erro 404.",
        "Onboarding": "Fluxo inicial de integração e configuração para novos usuários.",
        "PipelineRuns": "Histórico de execuções de pipelines de automação.",
        "QueueLogs": "Logs e histórico da fila de processamento assíncrono.",
        "ResetPassword": "Fluxo de recuperação e redefinição de senha.",
        "ScheduledReports": "Configuração de relatórios agendados.",
        "Sequences": "Criação e gestão de sequências de acompanhamento (follow-up).",
        "Settings": "Configurações gerais do sistema/conta.",
        "SettingsAppointmentKinds": "Configuração de tipos de agendamentos.",
        "SettingsAppointmentTypes": "Configuração das modalidades de compromissos.",
        "SettingsCustomFields": "Gerenciamento de campos personalizados para leads/contatos.",
        "SettingsForms": "Criação e configuração de formulários de captura.",
        "Tasks": "Gerenciamento de tarefas da equipe.",
        "Team": "Gestão de membros da equipe e permissões.",
        "Templates": "Gerenciamento de modelos de mensagens/documentos.",
        "Tracking": "Acompanhamento e rastreamento de links/acessos.",
        "TrackingDebug": "Ferramentas de depuração para rastreamento.",
        "Unsubscribe": "Página para leads solicitarem descadastramento."
    }
    
    # Try to find a direct match, else default text
    if name in purposes:
        return purposes[name]
    else:
        return f"Página/View responsável por lidar com {name.lower()}."

def main():
    try:
        with open('pages_analysis.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("pages_analysis.json not found")
        return
        
    markdown = "# Análise do Frontend (src/pages e src/layouts)\n\n"
    markdown += "Este documento contém o mapeamento de todas as views e páginas, detalhando seu propósito, fluxo de navegação e principais integrações/hooks.\n\n"
    
    # Sort files by path for better readability
    for filepath in sorted(data.keys()):
        info = data[filepath]
        if "error" in info:
            continue
            
        markdown += f"## Arquivo: `{filepath}`\n\n"
        
        # Purpose
        purpose = infer_purpose(filepath)
        markdown += f"**Propósito da View/Página:**\n{purpose}\n\n"
        
        # Flow/Routing
        links = info.get('links', [])
        navigates = info.get('navigates', [])
        
        markdown += "**Fluxo de navegação/roteamento:**\n"
        has_nav = False
        if links:
            markdown += "- **Links Diretos (`<Link>`):**\n"
            for link in links:
                markdown += f"  - `{link}`\n"
            has_nav = True
        
        if navigates:
            markdown += "- **Navegação Programática (`useNavigate`):**\n"
            for nav in navigates:
                markdown += f"  - `{nav}`\n"
            has_nav = True
            
        if not has_nav:
            markdown += "- Nenhuma navegação explícita identificada.\n"
            
        markdown += "\n"
        
        # Integrations & Hooks
        hooks = info.get('hooks', [])
        imports = info.get('imports', [])
        
        markdown += "**Principais integrações e hooks utilizados:**\n"
        
        important_hooks = [h for h in hooks if h.startswith('use') and h not in ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef']]
        if important_hooks:
            markdown += "- **Hooks de Negócio/Estado:** " + ", ".join(f"`{h}`" for h in sorted(important_hooks)) + "\n"
        else:
            markdown += "- **Hooks Básicos:** React standard hooks (`useState`, `useEffect`, etc).\n"
            
        # Detect Supabase, Stripe, etc
        integrations = []
        if any('supabase' in i for i in imports):
            integrations.append("Supabase (Backend/Auth)")
        if any('stripe' in i for i in imports):
            integrations.append("Stripe (Pagamentos)")
        if any('react-router' in i for i in imports):
            integrations.append("React Router (Navegação)")
        if any('dnd-kit' in i for i in imports):
            integrations.append("DnD Kit (Drag and Drop)")
        if any('date-fns' in i for i in imports):
            integrations.append("date-fns (Manipulação de Datas)")
        if any('sonner' in i for i in imports):
            integrations.append("Sonner (Notificações/Toasts)")
        if any('i18next' in i for i in imports):
            integrations.append("i18next (Internacionalização)")
        
        if integrations:
            markdown += "- **Integrações:** " + ", ".join(integrations) + "\n"
            
        markdown += "\n---\n\n"
        
    out_path = r'C:\Users\win\.gemini\antigravity\brain\914e66b6-a9cc-43f7-abc1-a8881dfde51f\scratch\analysis_frontend_pages.md'
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(markdown)
        
    print(f"Markdown successfully written to {out_path}")

if __name__ == '__main__':
    main()
