import os
import subprocess
import venv
import sys
import webbrowser
import time

def main():
    # Define o diretório base do projeto como o diretório atual de onde o script está sendo rodado
    base_dir = os.path.abspath(os.path.dirname(__file__))
    venv_dir = os.path.join(base_dir, 'venv')

    print("=== Iniciando a Configuração Automatizada do Projeto FuncGraph ===")

    # 1. Criação do Ambiente Virtual (venv)
    print("\n[1/4] Criando o ambiente virtual Python (venv)...")
    if not os.path.exists(venv_dir):
        builder = venv.EnvBuilder(with_pip=True)
        builder.create(venv_dir)
        print("Ambiente virtual de suporte criado com sucesso.")
    else:
        print("Ambiente virtual já existente. Pulando criação.")

    # Ajuste de executáveis conforme o sistema operacional (Windows vs Linux/Mac)
    if os.name == 'nt':
        npm_cmd = 'npm.cmd'
    else:
        npm_cmd = 'npm'

    # 2. Instalação das dependências do Frontend (Node.js)
    print("\n[2/4] Instalando dependências do projeto Node (npm install)...")
    try:
        subprocess.run([npm_cmd, 'install'], cwd=base_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Erro ao executar npm install: {e}")
        sys.exit(1)

    # 3. Executando o Build de teste do Frontend
    print("\n[3/4] Executando o build de produção para validação (npm run build)...")
    try:
        subprocess.run([npm_cmd, 'run', 'build'], cwd=base_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Erro ao executar o build: {e}")
        sys.exit(1)

    # 4. Iniciando o Servidor de Desenvolvimento e Abrindo o Navegador
    print("\n[4/4] === Configuração Concluída! Iniciando o servidor web... ===")

    frontend_process = None

    try:
        # Inicia o servidor de desenvolvimento do Vite em background
        frontend_process = subprocess.Popen([npm_cmd, 'run', 'dev'], cwd=base_dir)

        # Pequena pausa para garantir que o Vite suba antes de abrir o browser
        print("Abrindo o FuncGraph no seu navegador padrão...")
        time.sleep(2)
        
        # O Vite por padrão sobe em http://localhost:5173 se a porta estiver livre
        webbrowser.open("http://localhost:5173")

        print("\nAplicação em execução. Pressione Ctrl+C para encerrar o servidor.")
        
        # Mantém o script principal rodando enquanto o processo do Vite existir
        frontend_process.wait()

    except KeyboardInterrupt:
        print("\n\nEncerrando o servidor de forma segura...")
        if frontend_process:
            frontend_process.terminate()
        print("Servidor desativado. Até a próxima!")

if __name__ == '__main__':
    main()