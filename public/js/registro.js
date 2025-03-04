document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const successMessage = params.get("success");
  const errorMessage = params.get("error");

  if (successMessage) {
    Swal.fire({
      title: "Sucesso!",
      text: "Cadastro realizado com sucesso! Você será redirecionado para o login.",
      icon: "success",
      confirmButtonText: "OK",
      timer: 5000,
      timerProgressBar: true,
    }).then(() => {
      window.location.href = "/login"; // Redireciona após sucesso
    });
  } else if (errorMessage) {
    Swal.fire({
      title: "Erro!",
      text: decodeURIComponent(errorMessage),
      icon: "error",
      confirmButtonText: "OK",
    });
  }
});
// Inicializa o Choices para o select múltiplo
new Choices("#choices-multiple-remove-button", {
  removeItemButton: true,

  placeholder: true,
  placeholderValue: "Selecione os cursos",
});
