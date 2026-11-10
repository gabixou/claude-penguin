@echo off
REM Agendador do QA visual: roda uma sessao autonoma do Devin CLI a cada 30min.
cd /d E:\project\club-penguin-browser
if not exist tools\.visual-qa mkdir tools\.visual-qa
"C:\Users\GABS\AppData\Local\Programs\Devin\resources\app\extensions\windsurf\devin\bin\devin.exe" -p --prompt-file tools\visual-qa-task.txt --permission-mode smart --respect-workspace-trust false >> tools\.visual-qa\cron.log 2>&1
