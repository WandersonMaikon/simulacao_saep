const express = require("express");
const router = express.Router();

router.post("/admin/importar_alunos", (req, res) => {
  const alunos = req.body.alunos;
  if (!alunos || !Array.isArray(alunos)) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  // Monta a query para inserir os alunos
  const query = "INSERT INTO aluno (nome, usuario, senha, turma_id) VALUES ?";
  const values = alunos.map((a) => [a.nome, a.usuario, a.senha, a.turma_id]);

  // Usa a conexão disponível em req.db, que foi definida no middleware do index.js
  req.db.query(query, [values], (err, results) => {
    if (err) {
      console.error("Erro ao inserir alunos:", err);
      return res.status(500).json({ error: "Erro no banco de dados" });
    }
    res.json({ inserted: results.affectedRows });
  });
});

module.exports = router;
