const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "userData.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3001, () =>
      console.log("Server Running at http://localhost:3001/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/register", async (request, response) => {
  const { username, email, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE email = '${email}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (email, password, username)
     VALUES
      (
       '${email}',
       '${hashedPassword}',
       '${username}'  
      );`;
    const user = await database.run(createUserQuery);
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { email, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE email = '${email}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { email: email };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.email = payload.email;
        next();
      }
    });
  }
};

app.put(
  "/forgot-user-password",
  authenticationToken,
  async (request, response) => {
    let { email } = request;
    const { newPassword } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE email = '${email}';`;
    const databaseUser = await database.get(selectUserQuery);
    if (databaseUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const isPasswordMatched = await bcrypt.compare(
        newPassword,
        databaseUser.password
      );
      if (isPasswordMatched === false) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatePasswordQuery = `
          UPDATE
            user
          SET
            password = '${hashedPassword}'
          WHERE
            email = '${email}';`;

        const user = await database.run(updatePasswordQuery);
        response.send("Password updated");
      } else {
        response.status(400);
        response.send("Current password is same as old password.");
      }
    }
  }
);

// post  api
app.post(
  "/user/social-media-post",
  authenticationToken,
  async (request, response) => {
    let { email } = request;
    const { post_content } = request.body;
    const postRequestQuery = `INSERT INTO social_media_post(post_content, email) VALUES('${post_content}', '${email}');`;
    const postss = await database.run(postRequestQuery);
    const post_id = postss.lastID;
    response.send("Post Created Successfully.");
  }
);
//get post api
app.get(
  "/social-media-post",
  authenticationToken,
  async (request, response) => {
    let { email } = request;
    const postRequestQuery = `SELECT * FROM social_media_post WHERE email='${email}';`;
    const postss = await database.all(postRequestQuery);
    response.send(postss);
  }
);

//delete post api
app.delete(
  "/social-media-post/:post_id/",
  authenticationToken,
  async (request, response) => {
    let { post_id } = request.params;
    const postRequestQuery = `DELETE FROM social_media_post WHERE post_id='${post_id}';`;
    const postss = await database.run(postRequestQuery);
    response.send("Post Deleted Successfully.");
  }
);

//like and comment api
app.post(
  "/user/comment/:post_id/",
  authenticationToken,
  async (request, response) => {
    let { email } = request;
    let { post_id } = request.params;
    const { comment, like } = request.body;
    const selectUserQuery = `SELECT * FROM social_media_post WHERE post_id = '${post_id}';`;
    const databaseUser = await database.get(selectUserQuery);

    if (databaseUser === undefined) {
      response.status(400);
      response.send("Post not found");
    } else {
      const postRequestQuery = `INSERT INTO like_comments(post_id, comment, like, email) VALUES('${databaseUser.post_id}', '${comment}', '${like}', '${email}');`;
      const postss = await database.run(postRequestQuery);
      const post_id = postss.lastID;
      response.send("Post Created Successfully.");
    }
  }
);

//get like & comment api
app.get("/comment", authenticationToken, async (request, response) => {
  let { email } = request;
  const postRequestQuery = `SELECT * FROM like_comments WHERE email='${email}';`;
  const postss = await database.all(postRequestQuery);
  response.send(postss);
});

//delete comment api
app.delete(
  "/comment/:comment_id/",
  authenticationToken,
  async (request, response) => {
    let { comment_id } = request.params;
    const postRequestQuery = `DELETE FROM like_comments WHERE comment_id='${comment_id}';`;
    const postss = await database.run(postRequestQuery);
    response.send("Comment Deleted Successfully.");
  }
);

module.exports = app;
