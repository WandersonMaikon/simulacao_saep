$(document).ready(function () {
  // Cadastro de Questão: abrir e fechar modal
  $("#open-modal-questao").click(function () {
    $("#modal-questao").removeClass("hidden");
  });
  $("#close-modal-questao").click(function () {
    $("#modal-questao").addClass("hidden");
  });
  $("#form-cadastrar-questao").submit(function (event) {
    event.preventDefault();
    $.ajax({
      url: "/cadastrar-questao",
      type: "POST",
      data: $(this).serialize(),
      success: function (response) {
        $("#modal-questao").addClass("hidden");
        Swal.fire({
          title: response.message.includes("sucesso") ? "Sucesso!" : "Erro!",
          text: response.message.includes("sucesso")
            ? "Questão cadastrada com sucesso!"
            : response.message,
          icon: response.message.includes("sucesso") ? "success" : "error",
          confirmButtonText: "OK",
          timer: 5000,
          timerProgressBar: true,
        }).then(() => {
          window.location.href = "/questoes?page=1";
        });
      },
      error: function (xhr) {
        $("#modal-questao").addClass("hidden");
        let errorMsg =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          "Erro ao cadastrar questão.";
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

  // Exclusão de Questão
  $(document).on("click", ".delete-questao", function (e) {
    e.preventDefault();
    const questaoId = $(this).data("id");
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
          url: "/deletar-questao/" + questaoId,
          type: "GET", // ou "DELETE" se configurado
          success: function (response) {
            Swal.fire(
              "Excluída!",
              "A questão foi excluída com sucesso.",
              "success"
            ).then(() => {
              window.location.reload();
            });
          },
          error: function (xhr) {
            Swal.fire("Erro!", "Não foi possível excluir a questão.", "error");
          },
        });
      }
    });
  });

  // Edição de Questão: abrir modal com dados preenchidos
  $(document).on("click", ".edit-questao", function (e) {
    e.preventDefault();
    const id = $(this).data("id");
    const titulo = $(this).data("titulo");
    const curso_id = $(this).data("curso_id");
    const materia_id = $(this).data("materia_id");
    const enunciado = $(this).data("enunciado");
    const alternativa_a = $(this).data("alternativa_a");
    const alternativa_b = $(this).data("alternativa_b");
    const alternativa_c = $(this).data("alternativa_c");
    const alternativa_d = $(this).data("alternativa_d");
    const resposta_correta = $(this).data("resposta_correta");
    $("#edit_questao_id").val(id);
    $("#edit_questao_titulo").val(titulo);
    $("#edit_questao_curso_id").val(curso_id);
    $("#edit_questao_materia_id").val(materia_id);
    $("#edit_questao_enunciado").val(enunciado);
    $("#edit_questao_alternativa_a").val(alternativa_a);
    $("#edit_questao_alternativa_b").val(alternativa_b);
    $("#edit_questao_alternativa_c").val(alternativa_c);
    $("#edit_questao_alternativa_d").val(alternativa_d);
    $("#edit_questao_resposta_correta").val(resposta_correta);
    $("#modal-editar-questao").removeClass("hidden");
  });
  $("#close-edit-modal-questao").click(function () {
    $("#modal-editar-questao").addClass("hidden");
  });
  $("#form-editar-questao").submit(function (e) {
    e.preventDefault();
    Swal.fire({
      title: "Tem certeza?",
      text: "Deseja salvar as alterações nesta questão?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, editar!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/editar-questao",
          type: "POST",
          data: $("#form-editar-questao").serialize(),
          success: function (response) {
            Swal.fire(
              "Editada!",
              "Questão editada com sucesso!",
              "success"
            ).then(() => {
              window.location.reload();
            });
          },
          error: function (xhr) {
            let errorMsg =
              (xhr.responseJSON && xhr.responseJSON.error) ||
              "Erro ao editar questão.";
            Swal.fire("Erro!", errorMsg, "error");
          },
        });
      }
    });
  });
});
