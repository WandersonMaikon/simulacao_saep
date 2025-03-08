$(document).ready(function () {
  // Botão Cancelar na edição: se houver dados preenchidos, alerta que serão perdidos
  $("#cancel-edit-btn").click(function () {
    let hasData = false;
    $("#form-editar-questao")
      .find("input[type='text'], textarea")
      .each(function () {
        if ($(this).val().trim() !== "") {
          hasData = true;
          return false;
        }
      });
    if (hasData) {
      Swal.fire({
        title: "Tem certeza?",
        text: "Ao cancelar, as informações preenchidas serão perdidas.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, cancelar",
        cancelButtonText: "Voltar",
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
      }).then((result) => {
        if (result.isConfirmed) {
          $("#form-editar-questao")
            .find("input[type='text'], textarea")
            .val("");
          $("#edit-section").addClass("hidden");
          window.location.href = "/questao?page=1";
        }
      });
    } else {
      $("#form-editar-questao")[0].reset();
      $("#edit-section").addClass("hidden");
      window.location.href = "/questao?page=1";
    }
  });

  // Envio do formulário de edição via AJAX
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
              window.location.href = "/questao?page=1";
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
