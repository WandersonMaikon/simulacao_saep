$(document).ready(function () {
  // Ao clicar no botão de edição, abre o modal e preenche os campos
  $(document).on("click", ".edit-materia", function (e) {
    e.preventDefault();
    var id = $(this).data("id");
    var nome = $(this).data("nome");
    var curso_id = $(this).data("curso_id");

    $("#edit_id").val(id);
    $("#edit_nome_materia").val(nome);
    $("#edit_curso_id").val(curso_id);
    $("#modal-editar").removeClass("hidden");
  });

  // Fecha o modal de edição
  $("#close-edit-modal").click(function () {
    $("#modal-editar").addClass("hidden");
  });

  // Envio do formulário de edição com confirmação
  $("#form-editar-materia").submit(function (e) {
    e.preventDefault();

    Swal.fire({
      title: "Tem certeza?",
      text: "Deseja salvar as alterações nesta matéria?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, editar!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#02A824",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/editar-materia",
          type: "POST",
          data: $("#form-editar-materia").serialize(),
          success: function (response) {
            Swal.fire(
              "Editada!",
              "Matéria editada com sucesso!",
              "success"
            ).then(() => {
              window.location.reload();
            });
          },
          error: function (xhr) {
            var errorMsg =
              xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Erro ao editar matéria.";
            Swal.fire("Erro!", errorMsg, "error");
          },
        });
      }
    });
  });
});

$(document).ready(function () {
  // Abrir e fechar o modal de cadastro
  $("#open-modal").click(function () {
    $("#modal-uc").removeClass("hidden");
  });
  $("#close-modal").click(function () {
    $("#modal-uc").addClass("hidden");
  });

  // Envio do formulário de cadastro via AJAX
  $("#form-cadastrar-uc").submit(function (event) {
    event.preventDefault();
    $.ajax({
      url: "/cadastrar-materia",
      type: "POST",
      data: $(this).serialize(),
      success: function (response) {
        $("#modal-uc").addClass("hidden");
        Swal.fire({
          title: response.message.includes("sucesso") ? "Sucesso!" : "Erro!",
          text: response.message.includes("sucesso")
            ? "Cadastro realizado com sucesso!"
            : response.message,
          icon: response.message.includes("sucesso") ? "success" : "error",
          confirmButtonText: "OK",
          timer: 5000,
          timerProgressBar: true,
        }).then(() => {
          window.location.href = "/materias?page=1";
        });
      },
      error: function (xhr) {
        $("#modal-uc").addClass("hidden");
        let errorMsg =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          "Erro ao cadastrar matéria.";
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

  // Exclusão via AJAX com SweetAlert2
  $(document).ready(function () {
    // Captura o clique no botão com a classe "delete-materia"
    $(document).on("click", ".delete-materia", function (e) {
      e.preventDefault();
      const materiaId = $(this).data("id");

      // Exibe confirmação com SweetAlert2
      Swal.fire({
        title: "Tem certeza?",
        text: "Esta ação não pode ser desfeita.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, excluir!",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#02A824",
        cancelButtonColor: "#d33",
      }).then((result) => {
        if (result.isConfirmed) {
          // Envia a requisição AJAX para excluir a matéria
          $.ajax({
            url: "/deletar-materia/" + materiaId,
            type: "GET", // Altere para "DELETE" se estiver usando esse método
            success: function (response) {
              Swal.fire(
                "Excluída!",
                "A matéria foi excluída com sucesso.",
                "success"
              ).then(() => {
                // Atualiza a página ou remova a linha da tabela dinamicamente
                window.location.reload();
              });
            },
            error: function (xhr) {
              Swal.fire(
                "Erro!",
                "Não foi possível excluir a matéria.",
                "error"
              );
            },
          });
        }
      });
    });
  });
});
$(document).ready(function () {
  $("#open-modal").click(function () {
    $("#modal-uc").removeClass("modal-hidden");
  });

  $("#close-modal").click(function () {
    $("#modal-uc").addClass("modal-hidden");
  });

  $("#close-edit-modal").click(function () {
    $("#modal-editar").addClass("modal-hidden");
  });
});
