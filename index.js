require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();

// Configuração do banco de dados MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.connect((error) => {
  if (error) {
    console.error("Erro ao conectar ao banco de dados:", error);
  } else {
    console.log("Conectado ao MySQL com sucesso");
  }
});

// Configuração do Express e middlewares
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware de autenticação: redireciona para /login se o usuário não estiver logado
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// ======================================
// Rotas de Login e Registro
// ======================================

// Exibe a página de login (GET)
app.get("/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = ""; // Limpa a mensagem para evitar repetição
  res.render("login", { message });
});

// Processa o login (POST)
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SELECT * FROM professor WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Erro na consulta SQL:", err);
        return res.render("login", { message: "Erro no sistema" });
      }
      if (results.length === 0) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      const user = results[0];
      const passwordMatch = await bcrypt.compare(password, user.senha);
      if (!passwordMatch) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      req.session.user = user;
      req.session.successMessage = "Logado com sucesso!";
      res.redirect("/dashboard");
    }
  );
});

// Exibe o dashboard (somente para usuários autenticados)
app.get("/dashboard", verificarAutenticacao, (req, res) => {
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;
  res.render("dashboard", {
    username: req.session.user.nome,
    message: successMessage,
  });
});

// Exibe a página de registro (GET)
app.get("/registro", (req, res) => {
  // Aqui são buscados todos os cursos; se desejar filtrar, ajuste conforme necessário
  db.query("SELECT id, nome FROM curso", (err, results) => {
    if (err) {
      console.error("Erro ao buscar cursos:", err);
      return res.render("registro", {
        message: "Erro ao carregar cursos",
        cursos: [],
      });
    }
    res.render("registro", { message: "", cursos: results });
  });
});

// Processa o registro de usuário (POST)
app.post("/registro", async (req, res) => {
  const { nome, matricula, curso, email, password } = req.body;

  // Verifica se a matrícula é válida
  db.query(
    "SELECT * FROM matricula_validada WHERE matricula = ?",
    [matricula],
    async (error, results) => {
      if (error) {
        console.error("Erro ao verificar matrícula:", error);
        return res.render("registro", {
          message: "Erro no sistema. Tente novamente!",
        });
      }
      if (results.length === 0) {
        return res.render("registro", {
          message: "Matrícula inválida ou não cadastrada.",
        });
      }
      // Criptografa a senha
      const hashedPassword = await bcrypt.hash(password, 10);
      // Insere o professor
      db.query(
        "INSERT INTO professor (nome, matricula, curso_id, email, senha) VALUES (?, ?, ?, ?, ?)",
        [nome, matricula, curso, email, hashedPassword],
        (error, result) => {
          if (error) {
            console.error("Erro ao cadastrar professor:", error);
            return res.render("registro", {
              message: "Erro ao criar professor.",
            });
          }
          const professorId = result.insertId;
          // Adiciona o relacionamento na tabela professor_curso
          db.query(
            "INSERT INTO professor_curso (professor_id, curso_id) VALUES (?, ?)",
            [professorId, curso],
            (err) => {
              if (err) {
                console.error("Erro ao vincular professor ao curso:", err);
                return res.render("registro", {
                  message: "Erro ao vincular professor ao curso.",
                });
              }
              return res.render("registro", {
                message: "Cadastro realizado com sucesso!",
                cursos: [],
              });
            }
          );
        }
      );
    }
  );
});

// ======================================
// Rotas para Matérias (Listagem, Cadastro, Exclusão)
// ======================================

// Exibe a listagem de matérias com paginação (GET /materias)
app.get("/materias", verificarAutenticacao, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10; // 10 registros por página
  const offset = (page - 1) * limit;

  // Conta o total de registros
  db.query("SELECT COUNT(*) AS count FROM materia", (err, countResult) => {
    if (err) {
      console.error("Erro ao contar matérias:", err);
      return res.render("materia", {
        message: "Erro ao buscar matérias",
        materias: [],
        currentPage: page,
        totalPages: 0,
        totalRows: 0,
        cursos: [],
      });
    }
    const totalRows = countResult[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // Busca as matérias com JOIN no curso
    db.query(
      "SELECT m.id, m.nome, m.curso_id, c.nome AS curso FROM materia m INNER JOIN curso c ON m.curso_id = c.id LIMIT ? OFFSET ?",
      [limit, offset],
      (err, materias) => {
        if (err) {
          console.error("Erro ao buscar matérias:", err);
          return res.render("materia", {
            message: "Erro ao buscar matérias",
            materias: [],
            currentPage: page,
            totalPages: 0,
            totalRows: 0,
            cursos: [],
          });
        }
        // Busca somente os cursos vinculados ao professor logado para o modal de cadastro
        db.query(
          "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso pc ON curso.id = pc.curso_id WHERE pc.professor_id = ?",
          [req.session.user.id],
          (err, cursos) => {
            if (err) {
              console.error("Erro ao buscar cursos do professor:", err);
              cursos = [];
            }
            res.render("materia", {
              message: "",
              materias,
              currentPage: page,
              totalPages,
              totalRows,
              cursos,
            });
          }
        );
      }
    );
  });
});

// Processa o cadastro de nova matéria (POST /cadastrar-materia)
// Essa rota é chamada via AJAX e retorna JSON
app.post("/cadastrar-materia", verificarAutenticacao, (req, res) => {
  const { nome_materia, curso_id } = req.body;
  if (!nome_materia || !curso_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
  }
  // Verifica se a matéria já existe para o mesmo curso
  db.query(
    "SELECT * FROM materia WHERE nome = ? AND curso_id = ?",
    [nome_materia, curso_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar matéria:", err);
        return res.status(500).json({ error: "Erro ao verificar matéria." });
      }
      if (results.length > 0) {
        return res
          .status(400)
          .json({ error: "Essa matéria já está cadastrada para este curso." });
      }
      // Insere a nova matéria
      db.query(
        "INSERT INTO materia (nome, curso_id) VALUES (?, ?)",
        [nome_materia, curso_id],
        (err, result) => {
          if (err) {
            console.error("Erro ao cadastrar matéria:", err);
            return res
              .status(500)
              .json({ error: "Erro ao cadastrar matéria." });
          }
          // Após inserir, retorna a lista atualizada (página 1)
          db.query(
            "SELECT m.id, m.nome, m.curso_id, c.nome AS curso FROM materia m INNER JOIN curso c ON m.curso_id = c.id LIMIT ? OFFSET ?",
            [10, 0],
            (err, materias) => {
              if (err) {
                console.error("Erro ao buscar matérias:", err);
                return res
                  .status(500)
                  .json({ error: "Erro ao buscar matérias." });
              }
              return res.json({
                message: "Cadastro realizado com sucesso!",
                materias,
              });
            }
          );
        }
      );
    }
  );
});

// Exclui uma matéria (GET /deletar-materia/:id)
// Essa rota é chamada via AJAX e retorna JSON
app.get("/deletar-materia/:id", verificarAutenticacao, (req, res) => {
  const materiaId = req.params.id;
  db.query("DELETE FROM materia WHERE id = ?", [materiaId], (err, result) => {
    if (err) {
      console.error("Erro ao excluir matéria:", err);
      return res.status(500).json({ error: "Erro ao excluir matéria." });
    }
    return res.json({ message: "Matéria excluída com sucesso!" });
  });
});

// ======================================
// Rota para Cadastrar Questões
// ======================================

app.post("/cadastrar-questao", verificarAutenticacao, (req, res) => {
  const professorId = req.session.user.id;
  const {
    enunciado,
    alternativaA,
    alternativaB,
    alternativaC,
    alternativaD,
    correta,
    titulo,
    curso,
    dificuldade,
  } = req.body;

  // Verifica se o professor tem permissão para cadastrar questões para o curso selecionado
  const verificaCursoQuery = `
    SELECT c.id 
    FROM curso c
    JOIN professor_curso pc ON c.id = pc.curso_id
    WHERE pc.professor_id = ? AND c.id = ?;
  `;
  db.query(verificaCursoQuery, [professorId, curso], (err, results) => {
    if (err) {
      console.error("Erro ao verificar curso:", err);
      return res.render("questoes", {
        message: "Erro ao verificar o curso.",
        cursos: [],
      });
    }
    if (results.length === 0) {
      return res.render("questoes", {
        message: "Você não tem permissão para cadastrar questões nesse curso.",
        cursos: [],
      });
    }
    // Ajuste a query conforme o esquema da sua tabela "questao"
    const cadastrarQuestaoQuery = `
      INSERT INTO questao (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta_correta, curso, titulo, dificuldade, professor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    db.query(
      cadastrarQuestaoQuery,
      [
        enunciado,
        alternativaA,
        alternativaB,
        alternativaC,
        alternativaD,
        correta,
        curso,
        titulo,
        dificuldade,
        professorId,
      ],
      (err) => {
        if (err) {
          console.error("Erro ao cadastrar questão:", err);
          return res.render("questoes", {
            message: "Erro ao cadastrar a questão.",
            cursos: [],
          });
        }
        return res.render("questoes", {
          message: "Questão cadastrada com sucesso!",
          cursos: [],
        });
      }
    );
  });
});

// ======================================
// Rota de Logout
// ======================================

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
