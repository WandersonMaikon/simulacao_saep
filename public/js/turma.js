$(document).ready(function () {
  // Cadastro de Turma
  $("#open-modal-turma").click(function () {
    $("#modal-turma").removeClass("modal-hidden");
  });

  $("#close-modal-turma").click(function () {
    $("#modal-turma").addClass("modal-hidden");
  });

  $("#form-cadastrar-turma").submit(function (event) {
    event.preventDefault();
    $.ajax({
      url: "/cadastrar-turma",
      type: "POST",
      data: $(this).serialize(),
      success: function (response) {
        $("#modal-turma").addClass("modal-hidden");
        Swal.fire({
          title: response.message.includes("sucesso") ? "Sucesso!" : "Erro!",
          text: response.message.includes("sucesso")
            ? "Turma cadastrada com sucesso!"
            : response.message,
          icon: response.message.includes("sucesso") ? "success" : "error",
          confirmButtonText: "OK",
          timer: 5000,
          timerProgressBar: true,
        }).then(() => {
          window.location.href = "/turmas?page=1";
        });
      },
      error: function (xhr) {
        $("#modal-turma").addClass("modal-hidden");
        let errorMsg =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          "Erro ao cadastrar turma.";
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

  // Exclusão de Turma
  $(document).on("click", ".delete-turma", function (e) {
    e.preventDefault();
    const turmaId = $(this).data("id");
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
          url: "/deletar-turma/" + turmaId,
          type: "GET",
          success: function (response) {
            Swal.fire(
              "Excluída!",
              "A turma foi excluída com sucesso.",
              "success"
            ).then(() => {
              window.location.reload();
            });
          },
          error: function (xhr) {
            Swal.fire("Erro!", "Não foi possível excluir a turma.", "error");
          },
        });
      }
    });
  });

  $(document).ready(function () {
    // Abre o modal de edição de turma
    $(".edit-turma").click(function (e) {
      e.preventDefault();
      // Preenche os campos do modal conforme necessário...
      $("#modal-editar-turma").removeClass("modal-hidden");
    });

    // Fecha o modal de edição de turma
    $("#close-edit-modal-turma").click(function () {
      $("#modal-editar-turma").addClass("modal-hidden");
    });
  });

  $("#form-editar-turma").submit(function (e) {
    e.preventDefault();
    Swal.fire({
      title: "Tem certeza?",
      text: "Deseja salvar as alterações nesta turma?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, editar!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: "/editar-turma",
          type: "POST",
          data: $("#form-editar-turma").serialize(),
          success: function (response) {
            Swal.fire("Editada!", "Turma editada com sucesso!", "success").then(
              () => {
                window.location.reload();
              }
            );
          },
          error: function (xhr) {
            let errorMsg =
              xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Erro ao editar turma.";
            Swal.fire("Erro!", errorMsg, "error");
          },
        });
      }
    });
  });
});
