let BASE_URL = "";
 
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  BASE_URL = "http://localhost:4003";  
} else {
  BASE_URL = `http://${window.location.hostname}:4003`;
}
 
export default BASE_URL;