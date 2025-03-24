const express = require("express");
const router = express.Router();
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");

// Configura o multer para armazenar arquivos temporariamente
const upload = multer({ dest: "uploads/" });

router.post("/admin/aluno/importar", upload.single("arquivo"), (req, res) => {
  console.log("POST /admin/aluno/importar - req.body:", req.body);
  console.log("POST /admin/aluno/importar - req.query:", req.query);

  // Forçamos a pegar o valor de turma_id da query string e armazenamos em insertTurma
  const insertTurma = req.query.turma_id || 1;
  console.log("Valor de turma para INSERT (insertTurma):", insertTurma);

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo selecionado." });
  }

  const alunos = [];
  fs.createReadStream(file.path)
    .pipe(csvParser({ mapHeaders: ({ header }) => header.toLowerCase() }))
    .on("data", (row) => {
      console.log("Linha CSV lida:", row);
      alunos.push(row);
    })
    .on("end", () => {
      console.log("Alunos extraídos do CSV:", alunos);
      const db = req.db; // Conexão disponível via middleware

      let insertPromises = alunos.map((aluno) => {
        return new Promise((resolve, reject) => {
          // Verifica se os campos obrigatórios estão presentes
          if (!aluno.nome || !aluno.usuario || !aluno.senha) {
            console.error(
              "Linha inválida - faltando nome, usuario ou senha:",
              aluno
            );
            return resolve({ affectedRows: 0 });
          }
          // Se o CSV não tiver data_cadastro, usaremos NOW()
          const dataCadastro = aluno.data_cadastro ? aluno.data_cadastro : null;
          let query, params;
          if (dataCadastro) {
            query =
              "INSERT INTO aluno (nome, usuario, senha, turma_id, data_cadastro) VALUES (?, ?, ?, ?, ?)";
            params = [
              aluno.nome,
              aluno.usuario,
              aluno.senha,
              insertTurma,
              dataCadastro,
            ];
          } else {
            query =
              "INSERT INTO aluno (nome, usuario, senha, turma_id, data_cadastro) VALUES (?, ?, ?, ?, NOW())";
            params = [aluno.nome, aluno.usuario, aluno.senha, insertTurma];
          }
          console.log("Executando query:", query);
          console.log("Com parâmetros:", params);
          db.query(query, params, (err, results) => {
            if (err) {
              console.error("Erro na inserção do aluno:", aluno, err);
              return reject(err);
            }
            console.log("Aluno inserido com sucesso:", results);
            resolve(results);
          });
        });
      });

      Promise.all(insertPromises)
        .then((results) => {
          fs.unlinkSync(file.path);
          const totalInserted = results.reduce(
            (acc, curr) => acc + (curr.affectedRows || 0),
            0
          );
          console.log("Total de alunos inseridos:", totalInserted);
          res.json({ inserted: totalInserted });
        })
        .catch((err) => {
          console.error("Erro ao inserir alunos:", err);
          res.status(500).json({ error: "Erro ao importar alunos." });
        });
    });
});

module.exports = router;
