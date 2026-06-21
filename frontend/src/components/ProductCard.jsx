export default function ProductCard({ product }) {
  return (
    <article class={`product-card ${product.isSparePart ? 'spare-part' : ''}`}>
      {product.isSparePart && (
        <span class="badge-spare">Pieza / Accesorio</span>
      )}

      <div class="card-body">
        <h3>
          <a href={product.url} target="_blank" rel="noopener">
            {product.name}
          </a>
        </h3>

        {product.category && (
          <p class="category">{product.category}</p>
        )}

        {product.description && (
          <p class="description">{product.description}</p>
        )}

        <div class="card-footer">
          {product.price && (
            <span class="price">{product.price}</span>
          )}

          {product.rating && (
            <span class="rating">
              {'★'.repeat(Math.round(product.rating))}
              {'☆'.repeat(5 - Math.round(product.rating))}
              <small> ({product.reviewCount})</small>
            </span>
          )}

          <span class="score" title="Relevancia calculada por el modelo">
            {product.score}%
          </span>
        </div>

        {product.isSparePart && product.parentProduct && (
          <p class="compat">
            Compatible con: <a href={product.parentProduct} target="_blank">{product.parentProduct.split('/').pop()}</a>
          </p>
        )}
      </div>
    </article>
  )
}
