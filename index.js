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

// Configuração do middleware
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

// Middleware de autenticação
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Rota para processar o login
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

// Rota para exibir o dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage; // Remove a mensagem para evitar repetição

  res.render("dashboard", {
    username: req.session.user.nome,
    message: successMessage,
  });
});

// Rota para exibir a página de login
app.get("/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = ""; // Limpa a mensagem para evitar repetição ao dar refresh
  res.render("login", { message });
});

// Rota para exibir a página de registro com cursos dinâmicos
app.get("/registro", (req, res) => {
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

// Rota para processar o registro de usuário
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

          // Agora, adiciona o relacionamento na tabela professor_curso
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
              });
            }
          );
        }
      );
    }
  );
});

// Rota para exibir a página de cadastro de questões
app.get("/cadastrar-materia", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Verifica se o usuário está autenticado
  }

  const professorId = req.session.user.id;

  // Buscar cursos vinculados ao professor
  db.query(
    "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso ON curso.id = professor_curso.curso_id WHERE professor_curso.professor_id = ?",
    [professorId],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar cursos:", err);
        return res.render("materia", {
          message: "Erro ao carregar cursos.",
          cursos: [],
        });
      }

      // Verifica se a variável `cursos` está correta antes de renderizar a página
      console.log("Cursos carregados:", results);

      res.render("materia", { message: "", cursos: results });
    }
  );
});

app.post("/cadastrar-materia", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Verifica se o usuário está autenticado
  }

  const { nome_materia, curso_id } = req.body;

  if (!nome_materia || !curso_id) {
    return res.render("materia", {
      message: "Todos os campos são obrigatórios!",
      cursos: [],
    });
  }

  // Verifica se a matéria já existe no curso
  db.query(
    "SELECT * FROM materia WHERE nome = ? AND curso_id = ?",
    [nome_materia, curso_id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar matéria:", err);
        return res.render("materia", {
          message: "Erro ao verificar matéria.",
          cursos: [],
        });
      }

      if (results.length > 0) {
        return res.render("materia", {
          message: "Essa matéria já está cadastrada para este curso.",
          cursos: [],
        });
      }

      // Insere a nova matéria vinculada ao curso
      db.query(
        "INSERT INTO materia (nome, curso_id) VALUES (?, ?)",
        [nome_materia, curso_id],
        (err) => {
          if (err) {
            console.error("Erro ao cadastrar matéria:", err);
            return res.render("materia", {
              message: "Erro ao cadastrar matéria.",
              cursos: [],
            });
          }

          return res.render("materia", {
            message: "Matéria cadastrada com sucesso!",
            cursos: [],
          });
        }
      );
    }
  );
});

// Rota para cadastrar questões
app.post("/cadastrar-questao", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const professorId = req.session.user.id; // Obtendo o ID do professor logado
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

  // Verifica se o curso selecionado pertence ao professor logado
  const verificaCursoQuery = `
    SELECT c.id 
    FROM curso c
    JOIN professor p ON p.curso_id = c.id
    WHERE p.id = ? AND c.id = ?;
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

    // Insere a questão no banco de dados
    const cadastrarQuestaoQuery = `
      INSERT INTO questao (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta_correta, titulo, dificuldade)
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

// Rota para exibir o dashboard (protegida)
app.get("/dashboard", verificarAutenticacao, (req, res) => {
  res.render("dashboard", { username: req.session.user.nome });
});

// Rota para logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
