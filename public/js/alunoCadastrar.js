function atualizarTabelaAlunos() {
  var turmaId = $("input[name='turma_id']").val();
  var urlParams = new URLSearchParams(window.location.search);
  var page = urlParams.get("page") || 1;
  $.ajax({
    url: "/alunos-por-turma/" + turmaId + "?page=" + page,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Resposta de alunos:", data);
      var tbody = $("#aluno-table-body");
      tbody.empty();
      if (data.length > 0) {
        data.forEach(function (aluno) {
          tbody.append(`
            <tr>
              <td class="px-6 py-3">
                <input type="checkbox" name="alunos[]" value="${
                  aluno.id
                }" class="form-checkbox">
              </td>
              <td class="px-6 py-3">${aluno.id}</td>
              <td class="px-6 py-3">${aluno.nome}</td>
              <td class="px-6 py-3">${aluno.usuario || ""}</td>
              <td class="px-6 py-3">${aluno.senha || ""}</td>
              <td class="px-6 py-3">${
                aluno.data_cadastro
                  ? new Date(aluno.data_cadastro).toLocaleString("pt-BR")
                  : ""
              }</td>
              <td class="px-3 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <a href="#" class="edit-aluno inline-flex items-center justify-center h-8 w-8 rounded-md bg-cyan-500/20 text-cyan-500 transition-all duration-200 hover:bg-cyan-500 hover:text-white" data-id="${
                    aluno.id
                  }" data-nome="${aluno.nome}" data-usuario="${aluno.usuario}">
                    <i class="ph-duotone ph-pencil-simple-line text-base"></i>
                  </a>
                  <button class="delete-aluno inline-flex items-center justify-center h-8 w-8 rounded-md bg-red-500/20 text-red-500 transition-all duration-200 hover:bg-red-500 hover:text-white" data-id="${
                    aluno.id
                  }">
                    <i class="ph-duotone ph-trash text-base"></i>
                  </button>
                </div>
              </td>
            </tr>
          `);
        });
      } else {
        tbody.append(`
          <tr>
            <td colspan="7" class="text-center py-6">Nenhum aluno cadastrado nesta turma.</td>
          </tr>
        `);
      }
    },
    error: function () {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: "Erro ao atualizar a lista de alunos.",
      });
    },
  });
}

$(document).ready(function () {
  // Abertura e fechamento dos modais de cadastro e edição de alunos utilizando a classe modal-hidden
  $("#open-modal-aluno").click(function () {
    $("#modal-aluno").removeClass("modal-hidden");
  });
  $("#close-modal-aluno").click(function () {
    $("#modal-aluno").addClass("modal-hidden");
  });
  $("#close-edit-modal-aluno").click(function () {
    $("#modal-editar-aluno").addClass("modal-hidden");
  });

  // Envio do formulário de cadastro de aluno via AJAX
  $("#form-cadastrar-aluno").submit(function (event) {
    event.preventDefault();
    $.ajax({
      url: "/aluno/cadastrar",
      type: "POST",
      data: $(this).serialize(),
      dataType: "json",
      success: function (response) {
        $("#modal-aluno").addClass("modal-hidden");
        Swal.fire({
          title: "Sucesso!",
          text: "Aluno cadastrado com sucesso!",
          icon: "success",
          confirmButtonText: "OK",
          timer: 5000,
          timerProgressBar: true,
        }).then(function () {
          atualizarTabelaAlunos();
        });
        $("#form-cadastrar-aluno")[0].reset();
      },
      error: function (xhr) {
        $("#modal-aluno").addClass("modal-hidden");
        let errorMsg =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          "Erro ao cadastrar aluno.";
        Swal.fire({
          title: "Erro!",
          text: errorMsg,
          icon: "error",
          confirmButtonText: "OK",
          timer: 5000,
          timerProgressBar: true,
        });
      },
    });
  });

  // Exclusão de Aluno
  $(document).on("click", ".delete-aluno", function (e) {
    e.preventDefault();
    const alunoId = $(this).data("id");
    Swal.fire({
      title: "Tem certeza?",
      text: "Esta ação não pode ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/deletar-aluno/" + alunoId,
          type: "GET",
          success: function (response) {
            Swal.fire(
              "Excluído!",
              "O aluno foi excluído com sucesso.",
              "success"
            ).then(() => {
              atualizarTabelaAlunos();
            });
          },
          error: function (xhr) {
            Swal.fire("Erro!", "Não foi possível excluir o aluno.", "error");
          },
        });
      }
    });
  });

  // Edição de Aluno: abrir modal com dados preenchidos
  $(document).on("click", ".edit-aluno", function (e) {
    e.preventDefault();
    const id = $(this).data("id");
    const nome = $(this).data("nome");
    const usuario = $(this).data("usuario");
    $("#edit_aluno_id").val(id);
    $("#edit_aluno_nome").val(nome);
    $("#edit_aluno_usuario").val(usuario);
    $("#edit_aluno_senha").val("");
    $("#modal-editar-aluno").removeClass("modal-hidden");
  });
  $("#close-edit-modal-aluno").click(function () {
    $("#modal-editar-aluno").addClass("modal-hidden");
  });
  $("#form-editar-aluno").submit(function (e) {
    e.preventDefault();
    Swal.fire({
      title: "Tem certeza?",
      text: "Deseja salvar as alterações neste aluno?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, editar!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/editar-aluno",
          type: "POST",
          data: $("#form-editar-aluno").serialize(),
          success: function (response) {
            Swal.fire("Editado!", "Aluno editado com sucesso!", "success").then(
              () => {
                atualizarTabelaAlunos();
              }
            );
          },
          error: function (xhr) {
            let errorMsg =
              xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Erro ao editar aluno.";
            Swal.fire("Erro!", errorMsg, "error");
          },
        });
      }
    });
  });
});

$(document).ready(function () {
  var currentPath = window.location.pathname;
  $(".admin-menu a").each(function () {
    var linkPath = $(this).attr("href");
    if (currentPath === linkPath || currentPath.indexOf(linkPath) === 0) {
      $(this).addClass("active");
    }
  });
});
