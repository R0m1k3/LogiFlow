-- 🔍 DIAGNOSTIC SIMPLE - Une requête à la fois
-- Copiez chaque ligne et exécutez séparément

-- 1. Combien d'enregistrements dans chaque table ?
SELECT COUNT(*) FROM suppliers;

-- 2. 
SELECT COUNT(*) FROM groups;  

-- 3.
SELECT COUNT(*) FROM users;

-- 4. Si suppliers > 0, affichez les premiers
SELECT id, name FROM suppliers LIMIT 3;

-- 5. Si groups > 0, affichez les premiers  
SELECT id, name FROM groups LIMIT 3;

-- 6. Si users > 0, affichez les premiers
SELECT id, username FROM users LIMIT 3;