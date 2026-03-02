import { useParams } from "react-router-dom";
import styles from "./Post.module.css";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComment,
  faRectangleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { convertDateFromStr, getAssetUrl } from "../../../../utils/Helpers";
import { useAuth } from "../../../../Context/AuthContext";

const Post = () => {
  const { id } = useParams();
  const { setLoading } = useAuth();
  const [post, setPost] = useState(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const getPost = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/read/post/${id}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message);
          return;
        }
        setPost(data.post);
      } catch (error) {
        if (error.name === "AbortError") return;
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    getPost();
    return () => controller.abort();
  }, [id, setLoading]);

  const addComment = async (post_id) => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      toast.error("Comment cannot be empty.");
      return;
    }

    if (!confirm("Add Comment?")) return;
    try {
      const response = await fetch(`/api/create/comment/${post_id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: trimmedComment }),
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

  const getCommenterInitial = (username = "") => {
    return username.trim().charAt(0).toUpperCase() || "?";
  };

  if (!post) return <h1>Post not found</h1>;

  return (
    <div className={styles.postContainer}>
      <div className={styles.postContent}>
        {post.file_path && (
          <img
            src={getAssetUrl(post.file_path)}
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
                placeholder="Write a comment..."
              ></textarea>
              <div className={styles.commentActions}>
                <small>Posts publicly to this thread.</small>
                <button
                  type="button"
                  onClick={() => addComment(post.id)}
                  disabled={!comment.trim()}
                >
                  Comment
                </button>
              </div>
            </div>
          )}
          {post.comments.length !== 0 ? (
            post.comments.map(({ content, created_at, commenter }, index) => (
              <div
                key={index}
                className={`${styles.comment} ${
                  index % 2 === 1 ? styles.commentAlt : ""
                }`}
              >
                <div className={styles.commentMeta}>
                  <div className={styles.commentAvatar}>
                    {getCommenterInitial(commenter?.username)}
                  </div>
                  <div className={styles.commentIdentity}>
                    <p>{commenter.username}</p>
                    <small>{convertDateFromStr(created_at)}</small>
                  </div>
                </div>
                <p>{content}</p>
              </div>
            ))
          ) : (
            <div className={styles.comment}>
              <p className={styles.noComments}>Be the first to comment!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Post;
