import { useNavigate, useParams } from "react-router-dom";
import styles from "./Post.module.css";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faComment,
  faRectangleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { convertDateFromStr } from "../../../../utils/Helpers";
import { useAuth } from "../../../../Context/AuthContext";

const Post = () => {
  const { id } = useParams();
  const { setLoading } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const getPost = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/read/post/${id}`);
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message);
          return;
        }
        setPost(data.post);
      } finally {
        setLoading(false);
      }
    };

    getPost();
  }, [id, setLoading]);

  const addComment = async (post_id) => {
    if (!confirm("Add Comment?")) return;
    try {
      const response = await fetch(`/api/create/comment/${post_id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      toast.success(data.message);
      setPost((prev) => {
        return {
          ...prev,
          comments: [...prev.comments, data.comment],
        };
      });
      setComment("");
      setCommenting(false);
    } catch (error) {
      console.error("[COMMENT SUBMISSION ERROR]: ", error);
      toast.error(error.message);
    }
  };

  if (!post) return <h1>Post not found</h1>;

  return (
    <div className={styles.postContainer}>
      <FontAwesomeIcon
        icon={faChevronLeft}
        onClick={() => navigate(-1) || navigate("/posts")}
        className={styles.postReturnTo}
      />
      <div className={styles.postContent}>
        {post.file_path && (
          <img
            src={`https://mattsteamportal.com${post.file_path}`}
            alt={post.file_path}
            className={styles.postImage}
          />
        )}
        <div>
          <h1>{post.title}</h1>
          <small className={styles.author}>
            {post.author.first_name} {post.author.last_name}
          </small>
          <small>{convertDateFromStr(post.created_at)}</small>
          <p className={styles.postText}>{post.content}</p>
        </div>
      </div>
      <div className={styles.commentSection}>
        <h3>
          Comments
          <FontAwesomeIcon
            icon={commenting ? faRectangleXmark : faComment}
            onClick={() => setCommenting(!commenting)}
          />
        </h3>
        <div className={styles.comments}>
          {commenting && (
            <div className={styles.commentForm}>
              <textarea
                name="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
              <button type="button" onClick={() => addComment(post.id)}>
                Comment
              </button>
            </div>
          )}
          {post.comments.length !== 0 ? (
            post.comments.map(({ content, created_at, commenter }, index) => (
              <div key={index} className={styles.comment}>
                <p>{content}</p>
                <div>
                  <small>{convertDateFromStr(created_at)}</small>
                  <p>{commenter.username}</p>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.comment}>
              <p
                style={{
                  textAlign: "center",
                  color: "var(--linkText)",
                  paddingTop: "10px",
                }}
              >
                Be the first to comment!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Post;
