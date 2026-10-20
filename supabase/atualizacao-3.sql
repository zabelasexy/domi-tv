-- Atualização 3: tira os avisos "Function Search Path Mutable" do Security Advisor.
-- Fixa onde as funções procuram as tabelas, para ninguém conseguir "trocar" a tabela por baixo delas.
alter function public.touch_updated_at() set search_path = public;
alter function public.my_stats() set search_path = public;
